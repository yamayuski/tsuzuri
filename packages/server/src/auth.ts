/**
 * Authentication placeholder
 * 
 * In a real implementation, this would handle:
 * - User authentication (login/signup)
 * - Session management
 * - Authorization (who can access what)
 * - API key management
 */

export interface User {
  id: string;
  publicKey: string;
  username?: string;
  email?: string;
}

export interface AuthService {
  /**
   * Authenticate a user by public key
   */
  authenticate(publicKey: string): Promise<User | null>;

  /**
   * Check if a user has access to a document
   */
  authorize(userId: string, docId: string, action: 'read' | 'write'): Promise<boolean>;
}

/**
 * Minimal auth placeholder - allows all access
 */
export class PlaceholderAuthService implements AuthService {
  async authenticate(publicKey: string): Promise<User | null> {
    // For now, auto-create users based on public key
    return {
      id: publicKey,
      publicKey,
    };
  }

  async authorize(
    userId: string,
    docId: string,
    action: 'read' | 'write'
  ): Promise<boolean> {
    // For now, allow all access
    return true;
  }
}
