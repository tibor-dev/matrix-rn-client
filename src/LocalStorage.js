import AsyncStorage from '@react-native-async-storage/async-storage';

export const getPersistentValue = async (name) => {
    try {
        const value = await AsyncStorage.getItem(name);

        if (value !== null) {
            return value;
        }
        return null;
    } catch (e) {
        console.log(e);
        return null;
    }
};

export const setPersistentValue = async (name, value) => {
    try {
        console.log('setPersistentValue', name, value);
        await AsyncStorage.setItem(name, value);
    } catch (e) {
        console.log(e);
    }
};
