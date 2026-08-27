import { supabase } from "../lib/supabase";

export const diagramApi = {
  async list() {
    const { data, error } = await supabase
      .from("diagrams")
      .select("id, name, version, created_at, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return data;
  },
  async get(id) {
    const { data, error } = await supabase
      .from("diagrams")
      .select("*")
      .eq("id", id)
      .single();
    if (error) {
      if (error.code === "PGRST116") {
        throw new Error("Diagram not found");
      }
      throw error;
    }
    return data;
  },
  async create({ id, name, document }) {
    const { data, error } = await supabase
      .from("diagrams")
      .insert({ id, name, document })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") { // Unique violation
        throw new Error("Diagram already exists");
      }
      throw error;
    }
    return data;
  },
  async update(id, { name, document, baseVersion }) {
    // Optimistic concurrency control
    const { data, error } = await supabase
      .from("diagrams")
      .update({
        name,
        document,
        version: baseVersion + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("version", baseVersion)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // Did it fail because version mismatch or because it doesn't exist?
        const { data: current, error: fetchError } = await supabase
          .from("diagrams")
          .select("*")
          .eq("id", id)
          .single();
        if (fetchError) {
          throw new Error("Diagram not found");
        }
        const conflictError = new Error("Version conflict");
        conflictError.status = 409;
        conflictError.diagram = current;
        throw conflictError;
      }
      throw error;
    }
    return data;
  },
  async delete(id) {
    const { error } = await supabase.from("diagrams").delete().eq("id", id);
    if (error) throw error;
  },
};
