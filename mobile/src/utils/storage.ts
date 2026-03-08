/**
 * AsyncStorage utility functions
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

// Storage keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: "@epilink:auth_token",
  USER_DATA: "@epilink:user_data",
  REMEMBER_ME: "@epilink:remember_me",
  OFFLINE_QUEUE: "@epilink:offline_queue",
} as const;

/**
 * Store a value in AsyncStorage
 */
export const storeData = async (key: string, value: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(key, value);
  } catch (error) {
    console.error("Error storing data:", error);
    throw error;
  }
};

/**
 * Retrieve a value from AsyncStorage
 */
export const getData = async (key: string): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(key);
  } catch (error) {
    console.error("Error retrieving data:", error);
    return null;
  }
};

/**
 * Store an object in AsyncStorage
 */
export const storeObject = async (key: string, value: any): Promise<void> => {
  try {
    const jsonValue = JSON.stringify(value);
    await AsyncStorage.setItem(key, jsonValue);
  } catch (error) {
    console.error("Error storing object:", error);
    throw error;
  }
};

/**
 * Retrieve an object from AsyncStorage
 */
export const getObject = async <T>(key: string): Promise<T | null> => {
  try {
    const jsonValue = await AsyncStorage.getItem(key);
    return jsonValue != null ? JSON.parse(jsonValue) : null;
  } catch (error) {
    console.error("Error retrieving object:", error);
    return null;
  }
};

/**
 * Remove a value from AsyncStorage
 */
export const removeData = async (key: string): Promise<void> => {
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error("Error removing data:", error);
    throw error;
  }
};

/**
 * Clear all data from AsyncStorage
 */
export const clearAll = async (): Promise<void> => {
  try {
    await AsyncStorage.clear();
  } catch (error) {
    console.error("Error clearing storage:", error);
    throw error;
  }
};

/**
 * Store auth token
 */
export const storeAuthToken = async (token: string): Promise<void> => {
  return storeData(STORAGE_KEYS.AUTH_TOKEN, token);
};

/**
 * Get auth token
 */
export const getAuthToken = async (): Promise<string | null> => {
  return getData(STORAGE_KEYS.AUTH_TOKEN);
};

/**
 * Remove auth token
 */
export const removeAuthToken = async (): Promise<void> => {
  return removeData(STORAGE_KEYS.AUTH_TOKEN);
};

/**
 * Store user data
 */
export const storeUserData = async (user: any): Promise<void> => {
  return storeObject(STORAGE_KEYS.USER_DATA, user);
};

/**
 * Get user data
 */
export const getUserData = async <T>(): Promise<T | null> => {
  return getObject<T>(STORAGE_KEYS.USER_DATA);
};

/**
 * Remove user data
 */
export const removeUserData = async (): Promise<void> => {
  return removeData(STORAGE_KEYS.USER_DATA);
};

/**
 * Clear auth data
 */
export const clearAuthData = async (): Promise<void> => {
  await removeAuthToken();
  await removeUserData();
};
