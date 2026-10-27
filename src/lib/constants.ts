export const APP_NAME = "Waypoint";

export const PASSWORD_POLICY = {
  minLength: 8,
  requireLetter: true,
  requireNumber: true,
  description:
    "Password must be at least 8 characters and include a letter and a number.",
};

export function isPasswordValid(password: string): boolean {
  if (password.length < PASSWORD_POLICY.minLength) return false;
  if (PASSWORD_POLICY.requireLetter && !/[A-Za-z]/.test(password)) return false;
  if (PASSWORD_POLICY.requireNumber && !/[0-9]/.test(password)) return false;
  return true;
}

export const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;
