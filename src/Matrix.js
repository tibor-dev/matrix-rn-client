import React from 'react';
import Promise from 'bluebird';
Promise.config({
    warnings: false,
});

import {TextInput, Button, StyleSheet, Text, View, Image, FlatList, TouchableHighlight, ScrollView} from 'react-native';

import axios from 'axios';

import './DocumentPolyfill';

// Pull in the encryption lib so that we can decrypt attachments.
import Crypto from 'react-native-quick-crypto';

import sdk from 'matrix-js-sdk';
import AsyncStorage from '@react-native-async-storage/async-storage';

import AsyncCryptoStore from './AsyncCryptoStore.js';
import {getAllowedMimeType} from './MimeTypes.js';
import {getPersistentValue, setPersistentValue} from './LocalStorage.js';

// Pin the Buffer version
var Buffer = require('@craftzdog/react-native-buffer').Buffer;
import {decryptAttachment} from './AttachementCrypto.js';

const MATRIX_CLIENT_START_OPTIONS = {
    initialSyncLimit: 10,
    lazyLoadMembers: true,
    pendingEventOrdering: 'detached',
    timelineSupport: true,
    unstableClientRelationAggregation: true,
    sessionStore: new sdk.MemoryStore(AsyncStorage),
    cryptoStore: new AsyncCryptoStore(AsyncStorage),
};

const baseUrl = 'https://matrix-client.matrix.org';
class Matrix extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            userName: 'tbatest',
            password: 'W]!5NDT)<f8<lPu,tS}Z',
            userId: '',
            accessToken: '',
            client: '',
            newRoom: '',
            room_alias: 'not in a room',
            nextSyncToken: '',
            room_id: '',
            roomToJoin: '',
            memberList: [],
            rooms: [],
            hasRooms: false,
            message: '',
            messages: {},
            isTyping: false,
            displayName: '',

            loggedIn: false,
        };
    }
    login = async (e) => {
        const {userName, password} = this.state;
        let url = baseUrl + '/_matrix/client/v3/login';

        try {
            // Check if the token is already saved
            let access_token = await getPersistentValue('access_token');
            let device_id = await getPersistentValue('device_id');
            let user_id = await getPersistentValue('user_id');
            let data = {};

            if (access_token && device_id) {
                console.log('Use saved credentials for login');
                data.access_token = access_token;
                data.device_id = device_id;
                data.user_id = user_id;
            } else {
                //let res = await axios.get(url);
                let loginResponse = await axios.post(url, {
                    type: 'm.login.password',
                    identifier: {
                        type: 'm.id.user',
                        user: userName,
                    },
                    password: password,
                    initial_device_display_name: 'qualido App 2',
                });

                console.log('login response', loginResponse);

                if (loginResponse.data) {
                    data = loginResponse.data;
                    if (data.access_token) {
                        // Save it for later use
                        await setPersistentValue('access_token', data.access_token);
                        await setPersistentValue('device_id', data.device_id);
                        await setPersistentValue('user_id', data.user_id);
                    }
                }
            }

            let client = sdk.createClient({
                baseUrl: baseUrl,
                accessToken: data.access_token,
                userId: data.user_id,
                deviceId: data.device_id,
                fetchFn: (url, args) => {
                    console.log('fetch', JSON.stringify(url), typeof url, url.endsWidth);
                    const uri = new URL(url);
                    const searchParams = new URLSearchParams(uri);
                    searchParams.delete('_');
                    return fetch(url, args);
                },
                ...MATRIX_CLIENT_START_OPTIONS,
            });

            let cryptoInited = await client.initCrypto();

            console.log('cryptoInited', cryptoInited);

            let _this = this;
            client.on('sync', function (state, prevState, data) {
                try {
                    // console.log('client.on sync state', state, data)
                    _this.setState({
                        nextSyncToken: data.nextSyncToken,
                    });
                    switch (state) {
                        case 'PREPARED':
                            let roomList = client.getRooms();
                            _this.setState({rooms: roomList});
                            break;
                    }
                } catch (e) {
                    console.log(e, 'sync exception');
                }
            });
            client.on('Room.timeline', async function (event, state) {
                console.log('Client on Room.timeline', event.event.type);

                if (event.event.type == 'm.room.encrypted' || event.event.type == 'm.room.message') {
                    await client.decryptEventIfNeeded(event);

                    return _this.newMessage(event);
                }
            });
            client.on('RoomMember.typing', function (event, member) {
                var isTyping = member.typing;
                console.log('RoomMember.typing', member, event);
                if (isTyping) {
                    return _this.setState({
                        isTyping: {status: true, member: member},
                    });
                }
                return _this.setState({
                    isTyping: {status: false, member},
                });
            });

            client.on('RoomMember.membership', function (event, member) {
                if (member.membership === 'invite' && member.userId === _this.state.userId) {
                    client.joinRoom(member.roomId).done(function () {
                        let roomList = client.getRooms();
                        _this.setState({rooms: roomList});
                    });
                }
            });
            client.on('RoomState.members', function (event, state, member) {
                var room = client.getRoom(state.roomId);
                if (!room) {
                    return;
                }
                var memberList = state.getMembers();
                if (memberList.length > 0) {
                    _this.setState({
                        memberList: memberList,
                    });
                }
            });

            console.log('Starting client');
            client.startClient();

            //let values = await AsyncStorage.getAllKeys();

            //console.log('LocalStorage values', values);

            this.clearDevices(client);

            this.setState({
                userId: data.user_id,
                accessToken: data.access_token,
                client: client,
                loggedIn: true,
            });
        } catch (e) {
            console.log(e, ' login request result');
            console.log(e.message, ' login request result');
        }
    };

    logout = async (client) => {
        //await client.logout();

        // Clear the saved data
        await setPersistentValue('access_token', '');
        await setPersistentValue('device_id', '');
        await setPersistentValue('user_id', '');

        this.setState({
            userId: 0,
            accessToken: '',
            client: null,
            loggedIn: false,
        });

        const values = await AsyncStorage.getAllKeys();

        console.log('LocalStorage values', values, 'remove all');

        // Clear all
        await AsyncStorage.clear();
    };

    /**
     * Clear all devices associated with this account except for the one currently
     * in use.
     */

    clearDevices = async (client) => {
        const devices = await client.getDevices();

        const devicesIds = devices.devices.map((device) => device.device_id).filter((id) => id !== client.getDeviceId());

        await Promise.all(devicesIds.map((id) => client.deleteDevice(id)));
    };

    getRoomMessages = async (roomId, nextSyncToken, accessToken) => {
        try {
            let allMessages =
                baseUrl + `/_matrix/client/v3/rooms/${roomId}/messages?limit=10&from=${nextSyncToken}&access_token=${accessToken}&dir=b`;
            let result = await axios.get(allMessages);
            return result.data;
        } catch (error) {
            console.log(error);
        }
    };
    joinRoom = async (room) => {
        // e.preventDefault()
        //console.log('joining room', room)
        let {messages, roomToJoin, accessToken, client, nextSyncToken} = this.state;
        let url = baseUrl + `/_matrix/client/v3/join/${room.roomId}?access_token=${accessToken}`;
        try {
            let {data} = await axios.post(url, {
                room_id: roomToJoin,
            });
            let roomMessages = messages[room.roomId];
            //console.log('room messages', room.roomId, roomMessages);

            if (roomMessages && roomMessages.length > 0) {
                let lastMsg = roomMessages[roomMessages.length - 1];
                //console.log('last msg', lastMsg);
                // console.log(lastMsg.event,'aaaaaa')
                // client.sendReadReceipt(lastMsg.event)
            }

            //const values = await AsyncStorage.getAllKeys();

            //console.log('LocalStorage values', values);

            this.setState({
                room_id: room.roomId,
                room_alias: room.name,
            });
        } catch (e) {
            console.log('joinRoom exception', e);
        }
    };

    verifyDevice = async (client, userId, deviceId) => {
        await client.setDeviceKnown(userId, deviceId);
        await client.setDeviceVerified(userId, deviceId);
    };

    verifyDevices = async (e) => {
        let {client, room_id} = this.state;

        var room = client.getRoom(room_id);
        if (!room) {
            console.log('No room yet');
            return;
        }

        //console.log('Verifying room', room)

        const members = await room.getEncryptionTargetMembers();
        const verificationPromises = [];

        console.log('Room members', members);

        const crypto = client.getCrypto();

        if (crypto == null) {
            console.log('No crypto');
            return;
        }

        const deviceMap = await crypto.getUserDeviceInfo(members.map((m) => m.userId));

        console.log('Devices map', deviceMap);

        for (const [member, devices] of deviceMap.entries()) {
            for (const device of devices.values()) {
                if (!device.verified) {
                    verificationPromises.push(this.verifyDevice(client, member, device.deviceId));
                }
            }
        }

        await Promise.all(verificationPromises);
    };

    sendMessage = async (e) => {
        let {client, room_id, accessToken, message} = this.state;
        try {
            let content = {
                msgtype: 'm.text',
                body: message,
            };
            let sentMessage = await client.sendMessage(room_id, content);
            console.log('sent message ', sentMessage);
            let url = `${baseUrl}/_matrix/client/v3/rooms/${room_id}/read_markers?access_token=${accessToken}`;
            axios.post(url, {
                'm.fully_read': sentMessage.event_id,
            });
            client.sendTyping(room_id, false);
            this.setState({
                message: '',
            });
        } catch (e) {
            console.log('sendMessage exception', e);
        }
    };

    newMessage = async (event) => {
        let {room_id, messages, client} = this.state;
        console.log('newMessage', JSON.stringify(event));

        const name = event.sender ? event.sender.name : event.getSender() ?? '';
        const time = event.getTs();

        let eventContent = event.getContent(),
            content = '',
            msgType = '',
            url = '';

        if (event.getType() === 'm.room.message') {
            content = eventContent.body;

            msgType = eventContent.msgtype;

            switch (msgType) {
                case 'm.image':
                    if (eventContent.file) {
                        // Encrypted image

                        let httpUrl = client.mxcUrlToHttp(eventContent.file.url);

                        console.log('httpUrl', httpUrl);

                        let response = await axios.get(httpUrl, {responseType: 'arraybuffer'});

                        //console.log('encoded result', response);

                        if (response.status !== 200) {
                            console.log('Cannot download attachement');
                            break;
                        } else {
                            console.log('Attachement downloaded', response.data.byteLength, 'typeof', typeof response.data);

                            try {
                                console.log('eventContent.file', eventContent.file);

                                // Decrypt the array buffer using the information taken from the event content.
                                const dataBuffer = decryptAttachment(Buffer.from(response.data), eventContent.file);

                                let mimetype = eventContent.info?.mimetype ? eventContent.info.mimetype.split(';')[0].trim() : '';
                                mimetype = getAllowedMimeType(mimetype);

                                url = 'data:' + mimetype + ';base64,' + dataBuffer.toString('base64');

                                console.log('url created with length', url.length);
                            } catch (e) {
                                console.log('Cannot decrypt attachement', e);
                            }
                        }
                    } else {
                        // Unencrypted image
                        let httpUrl = client.mxcUrlToHttp(eventContent.url);

                        console.log('httpUrl', httpUrl);

                        url = httpUrl;
                    }

                    break;
            }
        } else if (event.isState()) {
            const stateKey = event.getStateKey();
            const postfix = stateKey == null || stateKey.length < 1 ? '' : ` (${stateKey})`;
            const stateName = `${event.getType()}${postfix}`;

            content = `[State: ${stateName} updated to: ${JSON.stringify(eventContent)}]`;
        } else {
            // random message event
            content = `[Message: ${event.getType()} Content: ${JSON.stringify(eventContent)}]`;
        }

        console.log(`[${time}] ${name} ${msgType} ${content}`);

        content = content ?? '';

        let message = {};
        if (!messages[event.event.room_id]) {
            messages[event.event.room_id] = [];
        }

        message['content'] = content;
        message['sender'] = name;
        message['time'] = time;

        if (url) {
            message['type'] = 'image';
            //console.log('Image received', url);
            message['url'] = url;
        }

        messages[event.event.room_id].push(message);

        //console.log('Messages:', messages);
        this.setState({
            messages: messages,
        });
    };

    handleChange = (stateKey, e) => {
        this.setState({
            [`${stateKey}`]: e,
        });
    };
    setTyping = (e) => {
        this.handleChange('message', e);
        let {client, room_id} = this.state;
        client.sendTyping(room_id, true);
    };

    userTyping = () => {
        let {isTyping, userId} = this.state;
        if (isTyping.status == true && isTyping.member.userId != userId) {
            return isTyping.member.name + ' is Typing';
        }
    };

    render() {
        let messages = this.state.messages[this.state.room_id] ? this.state.messages[this.state.room_id] : [];

        let key = 1;

        return (
            <ScrollView style={{height: '100%'}}>
                <TextInput style={{height: 40}} placeholder="username" onChangeText={(e) => this.handleChange('userName', e)} />
                <TextInput style={{height: 40}} placeholder="password" onChangeText={(e) => this.handleChange('password', e)} />
                {!this.state.loggedIn ? (
                    <Button style={{height: 40, width: 300}} onPress={this.login} title="LOGIN" />
                ) : (
                    <Button style={{height: 40, width: 300}} onPress={this.logout} title="LOGOUT" />
                )}
                <TextInput style={{height: 40}} placeholder="username" onChangeText={(e) => this.handleChange('newRoom', e)} />
                <Button onPress={this.createRoom} title="Add friend" />
                {this.state.rooms.map((item) => {
                    key += 1;
                    return (
                        <TouchableHighlight onPress={() => this.joinRoom(item)} key={key}>
                            <View key={item.roomId}>
                                <Text> {item.name} </Text>
                            </View>
                        </TouchableHighlight>
                    );
                })}

                <Text> now in room: {this.state.room_alias} </Text>
                <Button onPress={this.verifyDevices} title="Verify room member devices" />
                <TextInput onChangeText={(e) => this.setTyping(e)} />
                <Button onPress={this.sendMessage} title="send" />
                <View style={StyleSheet.chat}>
                    {messages.map((item) => {
                        key += 1;
                        return (
                            <View key={key}>
                                {item.url ? (
                                    <View style={{flexDirection: 'column'}}>
                                        <Image
                                            source={{uri: item.url}}
                                            style={{width: 150, height: 150, borderRadius: 8}}
                                            resizeMode="contain"
                                            onError={(error) => {
                                                console.log('Display error', error ? error.nativeEvent : '');
                                            }}
                                        />
                                        <Text> {item.content} </Text>
                                    </View>
                                ) : (
                                    <Text> {item.content} </Text>
                                )}
                            </View>
                        );
                    })}
                </View>
            </ScrollView>
        );
    }
}
const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F5FCFF',
    },
    welcome: {
        fontSize: 20,
        textAlign: 'center',
        margin: 10,
    },
    instructions: {
        textAlign: 'center',
        color: '#333333',
        marginBottom: 5,
    },
    chat: {
        flex: 1,
        height: 300,
    },
});

export default Matrix;
