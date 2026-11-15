import { createClient } from '@supabase/supabase-js';
import { createPreviewClient, previewMode } from './devPreview';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// In development, `?preview` swaps in an offline stand-in (see devPreview.js).
const preview = import.meta.env.DEV ? previewMode() : '';

export const supabase = preview ? createPreviewClient(preview) : createClient(supabaseUrl, supabaseKey);
