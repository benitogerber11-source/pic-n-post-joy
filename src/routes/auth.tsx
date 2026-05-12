import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ImageOff, Camera } from "lucide-react";
import palmIcon from "@/assets/palm.png";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({ meta: [{ title: "E-photo — Ingresar" }] }),
});

// Username: 3-30 chars, letters/numbers/underscore
const USERNAME_RE = /^[A-Za-z0-9_]{3,30}$/;
// Password: must START with uppercase letter, then allow letters/numbers and # % _
const PASSWORD_RE = /^[A-Z][A-Za-z0-9#%_]{5,63}$/;

// Synthesize a stable email so Supabase auth can be used with a username only.
const usernameToEmail = (u: string) => `${u.toLowerCase()}@ephoto.local`;

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate({ to: "/" });
    });
  }, [navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!USERNAME_RE.test(username)) {
      setError("El usuario debe tener 3-30 caracteres (letras, números o _).");
      return;
    }
    if (!PASSWORD_RE.test(password)) {
      setError("La contraseña debe empezar con mayúscula y puede incluir letras, números y # % _ (mín. 6).");
      return;
    }

    setLoading(true);
    const email = usernameToEmail(username);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { username },
          },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      // Cloud transition
      setTransitioning(true);
      setTimeout(() => navigate({ to: "/" }), 1100);
    } catch (err: any) {
      setError(mode === "signin" ? "Usuario o contraseña incorrectos." : (err.message ?? "Error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden flex items-center justify-center px-4 bg-gradient-sky">
      {/* Floating cloud-y orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-20 -left-16 size-80 rounded-full bg-white/30 blur-3xl animate-cloud-drift" />
        <div className="absolute top-1/3 -right-24 size-96 rounded-full bg-white/25 blur-3xl animate-cloud-drift" style={{ animationDelay: "2s" }} />
        <div className="absolute bottom-0 left-1/4 size-72 rounded-full bg-white/20 blur-3xl animate-cloud-drift" style={{ animationDelay: "4s" }} />
      </div>

      {/* Cloud overlay transition on success */}
      {transitioning && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          <div className="absolute inset-0 bg-white animate-cloud-rise" />
        </div>
      )}

      <Card className={`relative z-10 w-full max-w-md p-8 shadow-blue backdrop-blur bg-card/95 ${error ? "animate-shake-x" : ""}`}>
        <Link to="/" className="flex items-center gap-2 mb-6 justify-center">
          <img src={palmIcon} alt="" width={36} height={36} className="size-9" />
          <span className="text-2xl font-bold tracking-tight bg-gradient-deep bg-clip-text text-transparent">
            E-photo
          </span>
        </Link>

        <h1 className="text-2xl font-semibold mb-1 text-center">
          {mode === "signin" ? "Ingresar" : "Crear cuenta"}
        </h1>
        <p className="text-sm text-muted-foreground text-center mb-6">
          {mode === "signin" ? "Accedé a tu galería" : "Elegí tu usuario y contraseña"}
        </p>

        {error && (
          <div className="mb-5 rounded-lg border border-destructive/30 bg-destructive/5 p-4 flex flex-col items-center gap-2">
            <div className="relative">
              <div className="rounded-md border-2 border-dashed border-destructive/60 size-14 flex items-center justify-center bg-destructive/10">
                <ImageOff className="size-7 text-destructive" />
              </div>
              <Camera className="absolute -bottom-1 -right-1 size-5 text-destructive bg-card rounded-full p-0.5" />
            </div>
            <p className="text-sm text-destructive text-center">{error}</p>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Usuario</Label>
            <Input
              id="username"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="tu_usuario"
              maxLength={30}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ej: Azul_25#"
              maxLength={64}
            />
            {mode === "signup" && (
              <p className="text-xs text-muted-foreground">
                Empezá con mayúscula. Permitido: letras, números y # % _ (mín. 6).
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={loading || transitioning}>
            {loading ? "Procesando…" : mode === "signin" ? "Ingresar" : "Crear cuenta"}
          </Button>
        </form>

        <button
          onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); }}
          className="w-full text-sm text-muted-foreground hover:text-foreground mt-6 transition-colors"
        >
          {mode === "signin" ? "¿No tenés cuenta? Crear cuenta" : "¿Ya tenés cuenta? Ingresar"}
        </button>
      </Card>
    </div>
  );
}
