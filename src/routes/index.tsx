import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Camera, LogOut, Upload, Trash2, ImageIcon } from "lucide-react";

export const Route = createFileRoute("/")({
  component: GalleryPage,
  head: () => ({
    meta: [
      { title: "Photo Vault — Your private photo gallery" },
      { name: "description", content: "Upload and save your photos securely in your private vault." },
    ],
  }),
});

type Photo = {
  id: string;
  title: string | null;
  storage_path: string;
  created_at: string;
  url?: string;
};

function GalleryPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
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
        return { ...p, url: signed?.signedUrl };
      })
    );
    setPhotos(withUrls);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) loadPhotos();
  }, [user, loadPhotos]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
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
        title: title.trim() || null,
      });
      if (dbErr) throw dbErr;
      toast.success("Photo uploaded");
      setTitle("");
      if (fileInput.current) fileInput.current.value = "";
      loadPhotos();
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (photo: Photo) => {
    if (!confirm("Delete this photo?")) return;
    const { error: sErr } = await supabase.storage.from("photos").remove([photo.storage_path]);
    if (sErr) return toast.error(sErr.message);
    const { error: dErr } = await supabase.from("photos").delete().eq("id", photo.id);
    if (dErr) return toast.error(dErr.message);
    toast.success("Photo deleted");
    setPhotos((ps) => ps.filter((p) => p.id !== photo.id));
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background/80 backdrop-blur z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="size-6" />
            <h1 className="text-lg font-semibold tracking-tight">Photo Vault</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="size-4 mr-2" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <Card className="p-5 mb-8">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <label className="text-sm font-medium mb-1.5 block">Title (optional)</label>
              <Input
                placeholder="A sunset, my dog, vacation…"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={uploading}
              />
            </div>
            <div>
              <input
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
                {uploading ? "Uploading…" : "Upload photo"}
              </Button>
            </div>
          </div>
        </Card>

        {loading ? (
          <div className="text-center text-muted-foreground py-12">Loading photos…</div>
        ) : photos.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed rounded-lg">
            <ImageIcon className="size-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No photos yet. Upload your first one above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {photos.map((p) => (
              <Card key={p.id} className="overflow-hidden group relative">
                <div className="aspect-square bg-muted">
                  {p.url && (
                    <img
                      src={p.url}
                      alt={p.title ?? "Photo"}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  )}
                </div>
                {p.title && (
                  <div className="px-3 py-2 text-sm truncate" title={p.title}>
                    {p.title}
                  </div>
                )}
                <Button
                  size="icon"
                  variant="destructive"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity size-8"
                  onClick={() => handleDelete(p)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
