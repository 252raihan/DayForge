import { redirect } from "next/navigation";

// Send visitors to the dashboard. Middleware bounces signed-out users from
// there to /login, so this stays a one-line redirect.
export default function Home() {
  redirect("/dashboard");
}
