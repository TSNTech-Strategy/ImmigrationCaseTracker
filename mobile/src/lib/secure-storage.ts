import "react-native-get-random-values";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as aesjs from "aes-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Where the sign-in session is kept on the phone. Supabase sessions are too
 * large for the iOS keychain item limit, so (as Supabase recommends) the
 * session is AES-encrypted with a random key that lives in the keychain /
 * Android Keystore (expo-secure-store); only the ciphertext is in AsyncStorage.
 * The web preview (testing only) uses the browser's localStorage.
 */
class LargeSecureStore {
  private async encrypt(key: string, value: string) {
    const encryptionKey = crypto.getRandomValues(new Uint8Array(32));
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const encrypted = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
    await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey), { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK });
    return aesjs.utils.hex.fromBytes(encrypted);
  }
  private async decrypt(key: string, value: string) {
    const encryptionKeyHex = await SecureStore.getItemAsync(key);
    if (!encryptionKeyHex) return null;
    const cipher = new aesjs.ModeOfOperation.ctr(aesjs.utils.hex.toBytes(encryptionKeyHex), new aesjs.Counter(1));
    return aesjs.utils.utf8.fromBytes(cipher.decrypt(aesjs.utils.hex.toBytes(value)));
  }
  async getItem(key: string) {
    const encrypted = await AsyncStorage.getItem(key);
    return encrypted ? this.decrypt(key, encrypted) : null;
  }
  async setItem(key: string, value: string) {
    await AsyncStorage.setItem(key, await this.encrypt(key, value));
  }
  async removeItem(key: string) {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  }
}

const webStore = {
  getItem: async (k: string) => (typeof localStorage === "undefined" ? null : localStorage.getItem(k)),
  setItem: async (k: string, v: string) => {
    if (typeof localStorage !== "undefined") localStorage.setItem(k, v);
  },
  removeItem: async (k: string) => {
    if (typeof localStorage !== "undefined") localStorage.removeItem(k);
  },
};

export const sessionStorage = Platform.OS === "web" ? webStore : new LargeSecureStore();
