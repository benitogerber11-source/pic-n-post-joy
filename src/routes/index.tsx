import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  LogOut, Upload, Trash2, ImageIcon, ArrowUpDown,
  X, Download, ArrowDownAZ, ArrowUpAZ,
} from "lucide-react";
import palmIcon from "@/assets/palm.png";

export const Route = createFileRoute("/")({
  component: GalleryPage,
  head: () => ({
    meta: [
      { title: "E-photo — Tu galería" },
      { name: "description", content: "Tu galería privada de fotos en E-photo." },
    ],
  }),
});

type Photo = {
  id: string;
  title: string | null;
  storage_path: string;
  created_at: string;
  size_bytes: number;
  url?: string;
};

const STORAGE_LIMIT = 8 * 1024 * 1024 * 1024; // 8 GB
const fmtBytes = (b: number) => {
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
};

function GalleryPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sortDesc, setSortDesc] = useState(true);
  const [viewing, setViewing] = useState<Photo | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [authLoading, user, navigate]);

  const loadPhotos = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("photos")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const withUrls = await Promise.all(
      (data ?? []).map(async (p) => {
        const { data: signed } = await supabase.storage
          .from("photos")
          .createSignedUrl(p.storage_path, 3600);
        return { ...p, url: signed?.signedUrl } as Photo;
      })
    );
    setPhotos(withUrls);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) loadPhotos();
  }, [user, loadPhotos]);

  const usedBytes = useMemo(() => photos.reduce((s, p) => s + (p.size_bytes ?? 0), 0), [photos]);
  const usedPct = Math.min(100, (usedBytes / STORAGE_LIMIT) * 100);

  const sorted = useMemo(() => {
    const arr = [...photos];
    arr.sort((a, b) => {
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();
      return sortDesc ? db - da : da - db;
    });
    return arr;
  }, [photos, sortDesc]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Seleccioná una imagen");
      return;
    }
    if (usedBytes + file.size > STORAGE_LIMIT) {
      toast.error(`Sin espacio: el límite es 8 GB (usaste ${fmtBytes(usedBytes)}).`);
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("photos").upload(path, file);
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase.from("photos").insert({
        user_id: user.id,
        storage_path: path,
        title: file.name.replace(/\.[^.]+$/, "").slice(0, 80),
        size_bytes: file.size,
      });
      if (dbErr) throw dbErr;
      toast.success("Foto subida");
      if (fileInput.current) fileInput.current.value = "";
      loadPhotos();
    } catch (err: any) {
      toast.error(err.message ?? "Error al subir");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (photo: Photo) => {
    if (!confirm("¿Eliminar esta foto?")) return;
    const { error: sErr } = await supabase.storage.from("photos").remove([photo.storage_path]);
    if (sErr) return toast.error(sErr.message);
    const { error: dErr } = await supabase.from("photos").delete().eq("id", photo.id);
    if (dErr) return toast.error(dErr.message);
    toast.success("Foto eliminada");
    setPhotos((ps) => ps.filter((p) => p.id !== photo.id));
    if (viewing?.id === photo.id) setViewing(null);
  };

  const handleDownload = async (photo: Photo) => {
    if (!photo.url) return;
    try {
      const res = await fetch(photo.url);
      const blob = await res.blob();
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = u;
      a.download = (photo.title || "photo") + "." + (photo.storage_path.split(".").pop() ?? "jpg");
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(u);
    } catch {
      toast.error("No se pudo descargar");
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Cargando…</div>;
  }

  const username = (user.user_metadata as any)?.username ?? user.email?.split("@")[0];

  return (
    <div className="min-h-screen bg-gradient-to-b from-accent/30 via-background to-background">
      <header className="border-b sticky top-0 bg-background/80 backdrop-blur z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img src={palmIcon} alt="" width={32} height={32} className="size-8" />
            <h1 className="text-lg font-bold tracking-tight bg-gradient-deep bg-clip-text text-transparent">
              E-photo
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortDesc((s) => !s)}
              title={sortDesc ? "Más nuevas primero" : "Más viejas primero"}
            >
              {sortDesc ? <ArrowDownAZ className="size-4 mr-2" /> : <ArrowUpAZ className="size-4 mr-2" />}
              <span className="hidden sm:inline">{sortDesc ? "Recientes" : "Antiguas"}</span>
              <ArrowUpDown className="size-4 ml-1 sm:hidden" />
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="size-4 sm:mr-2" />
              <span className="hidden sm:inline">Salir</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 animate-cloud-rise">
        <Card className="p-5 mb-6 bg-card/80 backdrop-blur">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Hola, <span className="text-foreground font-medium">{username}</span></p>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-gradient-deep transition-all"
                    style={{ width: `${usedPct}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {fmtBytes(usedBytes)} / 8 GB
                </span>
              </div>
            </div>
            <div>
              <Input
                ref={fileInput}
                type="file"
                accept="image/*"
                onChange={handleUpload}
                className="hidden"
                disabled={uploading}
              />
              <Button
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
                className="w-full sm:w-auto"
              >
                <Upload className="size-4 mr-2" />
                {uploading ? "Subiendo…" : "Subir foto"}
              </Button>
            </div>
          </div>
        </Card>

        {loading ? (
          <div className="text-center text-muted-foreground py-12">Cargando fotos…</div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-primary/30 rounded-xl bg-card/40">
            <ImageIcon className="size-12 mx-auto text-primary/40 mb-3" />
            <p className="text-muted-foreground">Todavía no hay fotos. Subí la primera.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {sorted.map((p) => (
              <button
                key={p.id}
                onClick={() => setViewing(p)}
                className="group relative aspect-square overflow-hidden rounded-xl bg-muted shadow-sm hover:shadow-blue transition-all hover:-translate-y-0.5"
              >
                {p.url && (
                  <img
                    src={p.url}
                    alt={p.title ?? "Foto"}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-xs text-white truncate text-left">{p.title}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      {/* Fullscreen viewer with page-flip animation */}
      {viewing && (
        <div className="fixed inset-0 z-40 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="absolute top-4 left-4 right-4 flex justify-between gap-2 z-10">
            <Button variant="secondary" size="sm" onClick={() => setViewing(null)}>
              <X className="size-4 mr-2" /> Volver
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => handleDownload(viewing)}>
                <Download className="size-4 sm:mr-2" />
                <span className="hidden sm:inline">Descargar</span>
              </Button>
              <Button variant="destructive" size="sm" onClick={() => handleDelete(viewing)}>
                <Trash2 className="size-4 sm:mr-2" />
                <span className="hidden sm:inline">Eliminar</span>
              </Button>
            </div>
          </div>
          <div key={viewing.id} className="animate-page-flip max-w-5xl max-h-[85vh] w-full">
            {viewing.url && (
              <img
                src={viewing.url}
                alt={viewing.title ?? "Foto"}
                className="w-full h-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
              />
            )}
            {viewing.title && (
              <p className="text-center text-white/80 text-sm mt-3">{viewing.title}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
