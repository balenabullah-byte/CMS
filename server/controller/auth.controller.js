import users from '../module/user.module.js';
import { fail } from '../middleware/error.middleware.js';
import { verifyPassword } from '../security/password.js';
import { login, logout } from '../security/session.js';

class AuthController {
  async login(req, res, next) {
    try {
      const { body } = req.input;
      const account = await users.credentials({ email: body.email });
      const valid = await verifyPassword(body.password, account?.password_hash);
      if (!valid || !account?.is_active) fail(401, 'Invalid credentials');
      await login(req, res, account);
      res.status(200).json({ data: await users.getById(account.id) });
    } catch (error) {
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      await logout(req, res);
      res.status(200).json({ data: { logged_out: true } });
    } catch (error) {
      next(error);
    }
  }

  async me(req, res, next) {
    try {
      const user = req.user;
      res.status(200).json({ data: user });
    } catch (error) {
      next(error);
    }
  }
}
export default new AuthController();
