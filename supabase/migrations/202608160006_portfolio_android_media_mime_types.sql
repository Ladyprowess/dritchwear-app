-- Android media providers can return portfolio videos/photos with MIME types
-- beyond the initial mp4/quicktime + jpg/png/webp set.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'video/mp4',
  'video/quicktime',
  'video/x-m4v',
  'video/3gpp',
  'video/webm',
  'video/x-matroska'
]
WHERE id = 'portfolio-media';
