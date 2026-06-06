import { API } from "./constants";
import { api } from "./api";

export type AuthUser = {
  id?: number | string | null;
  username: string;
  name: string;
  email: string;
  studio_id?: number | string | null;
  studio_display?: string;
  group_list?: Array<{ id?: number | string; name?: string }>;
  super_user?: boolean;
};

export type AuthStatus = {
  auth_enabled: boolean;
  authenticated: boolean;
  user: AuthUser | null;
};

export function getAuthStatus() {
  return api.get<AuthStatus>(API.AUTH.ME);
}

export function keyLogin(key: string) {
  return api.post<AuthStatus>(API.AUTH.KEY_LOGIN, { key });
}

export function logout() {
  return api.post<AuthStatus>(API.AUTH.LOGOUT);
}
