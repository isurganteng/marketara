import type { AuthUser } from '../types';

export type AppEnv = {
  Variables: {
    user: AuthUser;
    sessionId: string;
    permissions: Set<string>;
  };
};
