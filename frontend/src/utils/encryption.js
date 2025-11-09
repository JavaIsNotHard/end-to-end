// End-to-end encryption utilities using Web Crypto API

export class EncryptionManager {
  constructor() {
    this.sharedSecret = null;
    this.derivedKey = null;
    this.currentUserId = null;
    this.currentPeerUserId = null;
    this.storedPrivateKey = null;
    this.storedPeerPublicKey = null;
  }

  // Get storage key for a conversation
  getStorageKey(userId1, userId2) {
    // Sort user IDs to ensure same key for both users
    const sorted = [userId1, userId2].sort();
    return `chat_key_${sorted[0]}_${sorted[1]}`;
  }

  // Store encryption keys for a conversation
  async storeKeys(userId1, userId2, privateKey, peerPublicKeyJwk) {
    try {
      const storageKey = this.getStorageKey(userId1, userId2);

      // Export private key as JWK
      const privateKeyJwk = await window.crypto.subtle.exportKey(
        'jwk',
        privateKey
      );

      const keyData = {
        privateKeyJwk,
        peerPublicKeyJwk,
        timestamp: Date.now()
      };

      localStorage.setItem(storageKey, JSON.stringify(keyData));
      this.currentUserId = userId1;
      this.currentPeerUserId = userId2;
      this.storedPrivateKey = privateKey;
      this.storedPeerPublicKey = peerPublicKeyJwk;

      console.log('Encryption keys stored for conversation');
    } catch (error) {
      console.error('Error storing keys:', error);
    }
  }

  // Load stored keys for a conversation
  async loadStoredKeys(userId1, userId2) {
    try {
      const storageKey = this.getStorageKey(userId1, userId2);
      const stored = localStorage.getItem(storageKey);

      if (!stored) {
        return null;
      }

      const keyData = JSON.parse(stored);

      // Import private key
      const privateKey = await window.crypto.subtle.importKey(
        'jwk',
        keyData.privateKeyJwk,
        {
          name: 'ECDH',
          namedCurve: 'P-256',
        },
        false,
        ['deriveKey', 'deriveBits']
      );

      // Derive the shared secret and key
      await this.deriveSharedSecret(privateKey, keyData.peerPublicKeyJwk);

      this.currentUserId = userId1;
      this.currentPeerUserId = userId2;
      this.storedPrivateKey = privateKey;
      this.storedPeerPublicKey = keyData.peerPublicKeyJwk;

      console.log('Stored encryption keys loaded for conversation');
      return true;
    } catch (error) {
      console.error('Error loading stored keys:', error);
      return false;
    }
  }

  // Check if we have stored keys for a conversation
  hasStoredKeys(userId1, userId2) {
    const storageKey = this.getStorageKey(userId1, userId2);
    return localStorage.getItem(storageKey) !== null;
  }

  // Generate a key pair for key exchange
  async generateKeyPair() {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true,
      ['deriveKey', 'deriveBits']
    );

    const publicKeyJwk = await window.crypto.subtle.exportKey(
      'jwk',
      keyPair.publicKey
    );

    return {
      keyPair,
      publicKeyJwk,
    };
  }

  // Derive shared secret from own private key and peer's public key
  async deriveSharedSecret(privateKey, peerPublicKeyJwk) {
    const peerPublicKey = await window.crypto.subtle.importKey(
      'jwk',
      peerPublicKeyJwk,
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      false,
      []
    );

    const sharedSecret = await window.crypto.subtle.deriveBits(
      {
        name: 'ECDH',
        public: peerPublicKey,
      },
      privateKey,
      256
    );

    this.sharedSecret = sharedSecret;

    // Derive AES key from shared secret
    const baseKey = await window.crypto.subtle.importKey(
      'raw',
      sharedSecret,
      'PBKDF2',
      false,
      ['deriveKey']
    );

    this.derivedKey = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: new TextEncoder().encode('e2e-chat-salt'),
        iterations: 100000,
        hash: 'SHA-256',
      },
      baseKey,
      {
        name: 'AES-GCM',
        length: 256,
      },
      false,
      ['encrypt', 'decrypt']
    );

    return this.derivedKey;
  }

  // Encrypt a message
  async encryptMessage(message) {
    if (!this.derivedKey) {
      throw new Error('Shared secret not established. Please exchange keys first.');
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(message);

    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      this.derivedKey,
      data
    );

    return {
      encryptedMessage: Array.from(new Uint8Array(encrypted)),
      iv: Array.from(iv),
      tag: null, // GCM includes tag in encrypted data
    };
  }

  // Decrypt a message
  async decryptMessage(encryptedData, iv) {
    if (!this.derivedKey) {
      throw new Error('Shared secret not established. Please exchange keys first.');
    }

    const encryptedArray = new Uint8Array(encryptedData);
    const ivArray = new Uint8Array(iv);

    try {
      const decrypted = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: ivArray,
        },
        this.derivedKey,
        encryptedArray
      );

      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      throw new Error('Failed to decrypt message. The message may be corrupted or the key is incorrect.');
    }
  }

  // Reset encryption state
  reset() {
    this.sharedSecret = null;
    this.derivedKey = null;
    this.currentUserId = null;
    this.currentPeerUserId = null;
    this.storedPrivateKey = null;
    this.storedPeerPublicKey = null;
  }

  // Clear stored keys for a conversation (optional - for security)
  clearStoredKeys(userId1, userId2) {
    const storageKey = this.getStorageKey(userId1, userId2);
    localStorage.removeItem(storageKey);
    console.log('Stored keys cleared for conversation');
  }
}

