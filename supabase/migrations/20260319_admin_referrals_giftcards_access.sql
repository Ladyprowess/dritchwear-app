-- ============================================================
-- Migration: Admin access for referrals and gift card templates
-- ============================================================

DROP POLICY IF EXISTS "Admin can read all referrals" ON referrals;
CREATE POLICY "Admin can read all referrals"
  ON referrals FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can read all gift card templates" ON gift_card_templates;
CREATE POLICY "Admins can read all gift card templates"
  ON gift_card_templates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );
