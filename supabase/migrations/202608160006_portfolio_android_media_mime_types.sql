-- Android media providers can return portfolio videos with MIME types beyond
-- the initial mp4/quicktime set.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/x-m4v',
  'video/3gpp',
  'video/webm',
  'video/x-matroska'
]
WHERE id = 'portfolio-media';
