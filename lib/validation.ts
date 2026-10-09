// Small, dependency-free validators shared by the auth forms.
// Each returns an error message string, or null when the value is fine.

// Deliberately simple: something@something.something, no spaces.
// The real authority is Supabase/the email provider, so we only catch typos.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(value: string): string | null {
  const email = value.trim();
  if (!email) return "Enter your email address.";
  if (!EMAIL_RE.test(email)) return "That doesn't look like a valid email address.";
  return null;
}

export function validatePassword(value: string): string | null {
  if (!value) return "Enter a password.";
  if (value.length < 8) return "Your password must be at least 8 characters.";
  return null;
}

export function validateName(value: string): string | null {
  const name = value.trim();
  if (!name) return "Enter your name.";
  if (name.length > 80) return "That name is too long (80 characters max).";
  return null;
}

export function validateConfirmPassword(
  password: string,
  confirm: string,
): string | null {
  if (!confirm) return "Re-enter your password to confirm.";
  if (password !== confirm) return "Those passwords don't match.";
  return null;
}

/**
 * Turns a Supabase auth error into something a student can act on.
 * Supabase messages are already fairly clear; we mainly translate the few
 * common ones and make sure nothing ever surfaces as a raw code.
 */
export function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();

  if (m.includes("invalid login credentials")) {
    return "Incorrect email or password. Please try again.";
  }
  if (m.includes("email not confirmed")) {
    return "Please confirm your email address first - check your inbox for the link we sent you.";
  }
  if (m.includes("user already registered")) {
    return "An account with that email already exists. Try logging in instead.";
  }
  if (m.includes("password should be at least")) {
    return "Your password is too short. Use at least 8 characters.";
  }
  if (m.includes("rate limit") || m.includes("too many requests")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (m.includes("weak password")) {
    return "That password is too easy to guess. Try a longer one.";
  }
  if (m.includes("for security purposes") && m.includes("seconds")) {
    return message; // e.g. "For security purposes, you can only request this after 47 seconds."
  }
  return message;
}
