/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
const fixed = [
  { id: 'photo-earth', width: 1024, height: 1024, inputBytes: 840544,
    sha256: 'c0f1b8184d2ff7843340bfc43661ad3d29212a9ac7a4fee3178178df64300bea',
    credit: 'NASA Johnson Space Center, Earth Science and Remote Sensing Unit; Apollo 17 Blue Marble',
    source: { fileName: 'photo-earth.jpg', inputBytes: 265324,
      sha256: '13419b34c17722be52b4a71a7f0beb3ecc8673183c8a2cee8572d5cd9bbe3f93',
      page: 'https://svs.gsfc.nasa.gov/30613/',
      url: 'https://svs.gsfc.nasa.gov/vis/a030000/a030600/a030613/blue_marble_apollo_17_19721207_print.jpg',
      rights: 'https://www.nasa.gov/nasa-brand-center/images-and-media/' } },
  { id: 'painting-cypresses', width: 599, height: 477, inputBytes: 568348,
    sha256: 'f870abf3446fc091d8f4d90f3742f0f5652229a78803a0c7419ea862b542c2bd',
    credit: 'Vincent van Gogh, Wheat Field with Cypresses, 1889; The Metropolitan Museum of Art, Open Access CC0',
    source: { fileName: 'painting-cypresses.jpg', inputBytes: 221383,
      sha256: 'af0e3486621c210b54932d055294051b5601aa3362af4b84ab97e2831f8163bc',
      page: 'https://collectionapi.metmuseum.org/public/collection/v1/objects/436535',
      url: 'https://images.metmuseum.org/CRDImages/ep/web-large/DP-42549-001.jpg',
      rights: 'https://www.metmuseum.org/policies/terms-and-conditions' } },
  { id: 'cover-type', width: 1024, height: 1024, inputBytes: 800,
    sha256: '7d6a33d95c2a4708cb74b14bdf4ea5b2135eb9ea6237d270613cd5954f554582',
    credit: 'Harmoniarr deterministic bitmap-letter artwork, GPL-3.0-or-later' },
  { id: 'cover-gradient', width: 1024, height: 1024, inputBytes: 5512,
    sha256: 'fc48e0bf2bd582bd83eaf43253ebf048064c530c5641cf2f060b1ac526452b6f',
    credit: 'Harmoniarr deterministic RGB gradient, GPL-3.0-or-later' },
];
export const webpArtworkInputs = Object.freeze(fixed.map(row => Object.freeze({
  ...row, source: row.source ? Object.freeze(row.source) : null, fileName: `${row.id}.webp`, format: 'webp', channels: 3, depth: 'uchar',
})));
export const webpArtworkCases = Object.freeze(webpArtworkInputs.flatMap(input => [2, 4].map(effort => Object.freeze({
  id: `${input.id}-effort-${effort}`, scope: input.id, effort, quality: 90, width: input.width, height: input.height, crop: null, input,
}))));
