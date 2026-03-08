import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-profile";
import { toast } from "sonner";

interface Contact {
  id: string;
  name: string;
  role: string;
  company: string;
  category: string;
  status: string;
  contacted_date: string | null;
  follow_up_date: string | null;
  notes: string;
}

interface Props {
  jobSeedId: number;
  company: string;
}

const STATUS_OPTIONS = [
  { value: "not_contacted", label: "Not Contacted", dot: "hsl(30 5% 59%)" },
  { value: "contacted", label: "Contacted", dot: "hsl(25 84% 31%)" },
  { value: "responded", label: "Responded", dot: "hsl(226 71% 48%)" },
  { value: "meeting_scheduled", label: "Meeting Scheduled", dot: "hsl(153 40% 30%)" },
  { value: "referral_received", label: "Referral Received", dot: "hsl(130 50% 35%)" },
];

const NetworkingTracker = ({ jobSeedId, company }: Props) => {
  const { data: profile } = useProfile();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", role: "", category: "alumni" });
  const [editId, setEditId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState("");

  useEffect(() => {
    if (!profile?.id) return;
    loadContacts();
  }, [profile?.id]);

  const loadContacts = async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from("networking_contacts")
      .select("*")
      .eq("profile_id", profile.id)
      .eq("job_seed_id", jobSeedId)
      .order("created_at", { ascending: false });
    if (data) setContacts(data as Contact[]);
  };

  const addContact = async () => {
    if (!profile?.id || !form.name.trim()) return;
    const { error } = await supabase.from("networking_contacts").insert({
      profile_id: profile.id,
      job_seed_id: jobSeedId,
      name: form.name,
      role: form.role,
      company,
      category: form.category,
    });
    if (error) { toast.error("Failed to add"); return; }
    toast.success("Contact added");
    setForm({ name: "", role: "", category: "alumni" });
    setShowAdd(false);
    loadContacts();
  };

  const updateStatus = async (id: string, status: string) => {
    const updates: any = { status };
    if (status === "contacted") updates.contacted_date = new Date().toISOString().split("T")[0];
    await supabase.from("networking_contacts").update(updates).eq("id", id);
    loadContacts();
  };

  const saveNotes = async (id: string) => {
    await supabase.from("networking_contacts").update({ notes: editNotes }).eq("id", id);
    setEditId(null);
    loadContacts();
    toast.success("Notes saved");
  };

  const deleteContact = async (id: string) => {
    await supabase.from("networking_contacts").delete().eq("id", id);
    loadContacts();
    toast.success("Contact removed");
  };

  const statusDot = (status: string) => STATUS_OPTIONS.find(s => s.value === status)?.dot || "hsl(30 5% 59%)";
  const statusLabel = (status: string) => STATUS_OPTIONS.find(s => s.value === status)?.label || status;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{contacts.length} contact{contacts.length !== 1 ? "s" : ""} tracked</div>
        <button onClick={() => setShowAdd(!showAdd)} className="bg-foreground text-background rounded-lg px-3 py-1.5 text-xs font-semibold hover:opacity-90 transition-opacity">
          + Add Contact
        </button>
      </div>

      {showAdd && (
        <div className="bg-secondary border border-border rounded-xl p-4 space-y-2 animate-in fade-in duration-200">
          <div className="grid grid-cols-3 gap-2">
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Name" className="bg-card border border-border rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20" />
            <input value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} placeholder="Role / Title" className="bg-card border border-border rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20" />
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="bg-card border border-border rounded-lg px-3 py-2 text-xs outline-none">
              <option value="alumni">School Alumni</option>
              <option value="prev_company">Previous Company</option>
              <option value="role_holder">Role Holder</option>
              <option value="hiring_team">Hiring Team</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={addContact} disabled={!form.name.trim()} className="bg-foreground text-background rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-40">Save</button>
            <button onClick={() => setShowAdd(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
          </div>
        </div>
      )}

      {contacts.length === 0 ? (
        <div className="text-center py-8 text-xs text-muted-foreground">
          No contacts tracked yet. Add people you're reaching out to for this role.
        </div>
      ) : (
        <div className="space-y-2">
          {contacts.map(c => (
            <div key={c.id} className="bg-card border border-border rounded-xl p-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-secondary-foreground">{c.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{c.name}</div>
                  <div className="text-[11px] text-muted-foreground">{c.role}{c.role && " · "}{c.category.replace("_", " ")}</div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={c.status}
                    onChange={e => updateStatus(c.id, e.target.value)}
                    className="bg-secondary border border-border rounded-lg px-2 py-1 text-[11px] outline-none"
                    style={{ color: statusDot(c.status) }}
                  >
                    {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <button onClick={() => deleteContact(c.id)} className="text-muted-foreground hover:text-destructive text-xs transition-colors">✕</button>
                </div>
              </div>
              {c.contacted_date && (
                <div className="text-[10px] text-muted-foreground mt-1 ml-11">Contacted: {new Date(c.contacted_date).toLocaleDateString()}</div>
              )}
              <div className="mt-2 ml-11">
                {editId === c.id ? (
                  <div className="flex gap-2">
                    <input value={editNotes} onChange={e => setEditNotes(e.target.value)} className="flex-1 bg-secondary border border-border rounded-lg px-2 py-1 text-xs outline-none" placeholder="Notes…" />
                    <button onClick={() => saveNotes(c.id)} className="text-xs font-medium text-primary">Save</button>
                  </div>
                ) : (
                  <button onClick={() => { setEditId(c.id); setEditNotes(c.notes || ""); }} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                    {c.notes ? `📝 ${c.notes}` : "+ Add notes"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NetworkingTracker;
