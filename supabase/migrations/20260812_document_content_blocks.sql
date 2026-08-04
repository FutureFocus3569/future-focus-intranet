-- Structured content for policy documents, so the "Create New Policy Version"
-- editor can work with real bullet items (each with an optional bold lead-in)
-- instead of one flat text blob, and the print/view output can render them
-- back into the branded policy template consistently.
--
-- Nullable: legacy documents keep working exactly as before (plain text via
-- extracted_text) until the first time they're edited through the
-- structured editor, at which point content_blocks gets populated.

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS content_blocks jsonb;

COMMENT ON COLUMN public.documents.content_blocks IS
  'Array of {lead, text} bullet items for structured policy editing/printing. Null for legacy documents not yet edited through the structured editor.';
