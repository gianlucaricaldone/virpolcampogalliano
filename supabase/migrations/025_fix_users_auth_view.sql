-- Fix the users auth status view
-- This migration properly creates the view with correct permissions

-- Drop the view if it exists (to handle any existing issues)
DROP VIEW IF EXISTS public.v_users_auth_status;

-- Create a simpler version that works with RLS
-- Note: Views with auth.users access need special handling in Supabase
CREATE OR REPLACE VIEW public.v_users_auth_status AS
SELECT 
    u.id,
    u.email,
    u.nome,
    u.cognome,
    u.role,
    'magic_link_only' as auth_method,  -- Simplified for now
    u.created_at,
    null::timestamp as last_sign_in_at  -- Placeholder
FROM public.users u
ORDER BY u.created_at DESC;

-- Grant permissions
GRANT SELECT ON public.v_users_auth_status TO authenticated;

-- Create policy for admin-only access
CREATE POLICY "Admin can view user auth status" ON public.v_users_auth_status
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND (role = 'admin' OR 'admin' = ANY(roles))
        )
    );

-- Enable RLS
ALTER VIEW public.v_users_auth_status ENABLE ROW LEVEL SECURITY;

-- Alternative: Create a function instead of a view for better control
CREATE OR REPLACE FUNCTION public.get_users_auth_status()
RETURNS TABLE (
    id uuid,
    email text,
    nome text,
    cognome text,
    role text,
    auth_method text,
    created_at timestamp with time zone,
    last_sign_in_at timestamp with time zone
) 
SECURITY DEFINER
AS $$
BEGIN
    -- Check if the calling user is admin
    IF NOT EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() AND (users.role = 'admin' OR 'admin' = ANY(users.roles))
    ) THEN
        RAISE EXCEPTION 'Access denied. Admin role required.';
    END IF;

    RETURN QUERY
    SELECT 
        u.id,
        u.email,
        u.nome,
        u.cognome,
        u.role,
        'magic_link_only'::text as auth_method,
        u.created_at,
        null::timestamp with time zone as last_sign_in_at
    FROM public.users u
    ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Grant execution permission
GRANT EXECUTE ON FUNCTION public.get_users_auth_status() TO authenticated;