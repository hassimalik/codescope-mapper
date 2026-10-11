export class AuthService {
  constructor() {}

  async login() {
    return true;
  }

  private logout() {}

  static create() {
    return new AuthService();
  }
}
