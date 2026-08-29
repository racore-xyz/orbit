# Arabic Design Mode

Use this reference only when the user requests Arabic, RTL, a bilingual Arabic/Latin experience, or an Arab-region cultural direction. It extends the parent skill; it does not replace that skill's normal pipeline, safety rules, or quality gates.

## 1. Activation and mode contract

Before designing, set the following six fields in the skill's existing brief or extraction output:

| Field | Required decision |
|---|---|
| Language | `Arabic-first`, `Arabic-only`, or `bilingual` |
| Locale | Country/region and language register, for example Egyptian Arabic, Saudi Arabic, Gulf Arabic, or Modern Standard Arabic |
| Direction | RTL base direction plus any LTR islands for email, code, URLs, measurements, Latin names, and international phone numbers |
| Heritage lane | `contemporary Arabic`, `Islamic geometric/arabesque`, `Pharaonic/Nile`, or `desert/Al Sadu`; choose one primary lane |
| Intensity | `trace` 5-10%, `accent` 10-25%, or `immersive` 25-40% of the visual field |
| Cultural source | Named place, period, object, craft, archive, or supplied brand guideline that makes the direction specific rather than generically “Middle Eastern” |

If the user only says “make it Arabic,” default to Arabic-first, Modern Standard Arabic, RTL, contemporary Arabic, trace intensity, and a neutral pan-Arab treatment. Do not invent a country, dynasty, religious affiliation, or folk tradition.

When the user names more than one heritage lane, appoint one dominant lane and at most one supporting lane. A 70/30 relationship is a useful ceiling. Never make an undifferentiated collage of pyramids, mosque arches, camels, lanterns, dunes, and calligraphy.

## 2. Evidence from awarded regional websites

Treat award galleries as evidence of interaction and composition patterns, not as permission to clone a site. Research completed for this mode found these useful, directly documented examples:

- [Webook - Riyadh Season](https://www.cssdesignawards.com/sites/webook-riyadh-season/45269), CSS Design Awards Website of the Day, 27 March 2024: immersive event storytelling with animation, video/sound, and WebGL.
- [Masar Destination](https://www.cssdesignawards.com/sites/masar-destination/42114), Website of the Day, 4 October 2022: Saudi destination storytelling with responsive WebGL and a high jury score.
- [IoT Squared](https://www.cssdesignawards.com/sites/iot-squared/46515/), Website of the Day, 12 November 2024: Saudi technology positioning expressed through animation, parallax, and WebGL rather than heritage cliches.
- [Kode](https://www.cssdesignawards.com/sites/kode/38354), Website of the Day, 26 December 2020: New Cairo sports brand using color, animation, and WebGL.
- [Ali Ali](https://www.cssdesignawards.com/sites/ali-ali/37626/), Website of the Day, 30 September 2020: a Cairo creative portfolio driven by minimal typography and film.
- [Sivik Atelier](https://www.cssdesignawards.com/sites/sivik-atelier/39593/), Website of the Day, 22 August 2021: Dubai studio portfolio using grid, parallax, and WebGL.
- [Jazean Coffee](https://www.cssdesignawards.com/sites/jazean-coffee/46646/), CSSDA Special Kudos, 27 November 2024: Saudi coffee heritage framed as interactive scroll storytelling.

The transferable finding is not “add WebGL.” Strong regional sites establish a contemporary editorial system first, then use one culturally meaningful material, narrative, or spatial idea as the signature. They also demonstrate that an Arab brand can look regionally grounded without covering every surface in ornament.

## 3. Arabic typography system

Arabic is not Latin text mirrored. Its connected shaping, diacritics, word silhouettes, vertical proportions, and bidirectional behavior require a separate type pass.

### Functional type roles

| Role | Preferred character | Safe starting families |
|---|---|---|
| Display / short hero | Contemporary Kufi or expressive Arabic display face | Noto Kufi Arabic, IBM Plex Sans Arabic, Changa, El Messiri, Reem Kufi |
| Body / editorial | Naskh or highly readable Arabic sans | Noto Naskh Arabic, Amiri, IBM Plex Sans Arabic, Noto Sans Arabic |
| UI / data | Compact, screen-optimized Arabic sans | Noto Sans Arabic, IBM Plex Sans Arabic, Cairo, Tajawal |
| Heritage accent | Ruq'ah, calligraphic, or commissioned lettering | Use only for short verified phrases, never body copy or controls |

Noto's own documentation characterizes Kufi as suitable for headlines and short text and Naskh as suitable for longer text: [Noto web font guidance](https://github.com/notofonts/noto-docs/blob/main/docs/website/use.md). Treat the table above as a shortlist, then verify the actual font files, license, Arabic glyph coverage, numerals, punctuation, diacritics, and paired Latin before committing.

### Arabic type rules

- Do not apply Latin display rules mechanically. Start Arabic hero tracking at `normal`; test only very small adjustments. Large negative `letter-spacing` can break joins or destroy word shapes.
- Give Arabic headings more line-height than compressed Latin headings. Start around `1.05-1.2` for display and `1.55-1.9` for body, then inspect diacritics and stacked glyphs.
- Keep hero lines short enough to preserve meaningful phrase groups. Balance by reading the sentence, not by forcing equal geometric line lengths.
- Use real Arabic copy. Never use disconnected letters, reversed strings, transliterated filler, or lorem ipsum presented as Arabic.
- Use Arabic punctuation in Arabic prose where appropriate: `،` `؛` `؟`. Do not blindly replace punctuation inside code, URLs, product IDs, or Latin phrases.
- Choose and document the numeral system: Arabic-Indic `٠١٢٣٤٥٦٧٨٩`, Latin `0123456789`, or locale-dependent. Consistency matters more than ornamental preference.
- Keep decorative calligraphy separate from semantic UI text. Logos and illustrations may use outlined lettering; accessible content must remain live text.
- Pair Arabic and Latin by visual color, x-height/line presence, weight, and tone, not by giving both scripts the same CSS size and assuming they match.

### Starting tokens

```css
:root {
  --font-ar-display: "Noto Kufi Arabic", "Noto Sans Arabic", sans-serif;
  --font-ar-body: "Noto Naskh Arabic", "Noto Sans Arabic", sans-serif;
  --font-latin: "Inter", system-ui, sans-serif;
}

:lang(ar) {
  font-family: var(--font-ar-body);
  line-height: 1.75;
}

:lang(ar) :is(h1, h2, h3) {
  font-family: var(--font-ar-display);
  letter-spacing: normal;
  line-height: 1.12;
}
```

These are fallbacks, not a forced aesthetic. Replace them when the brand or reference supports a stronger licensed family.

## 4. RTL and bilingual engineering contract

W3C guidance requires direction in markup, recommends logical CSS properties, and notes that numbers and embedded Latin remain LTR inside Arabic. Read [Arabic and Persian Layout Requirements](https://www.w3.org/TR/alreq/) and [Structural markup and RTL text](https://www.w3.org/International/questions/qa-html-dir.en.html) when implementing.

### Required markup

```html
<html lang="ar" dir="rtl">
  <body>
    <p>ابدأ تجربتك <bdi lang="en">Arabian Curb</bdi></p>
    <p>السعر <bdi dir="ltr">SAR 1,250</bdi></p>
    <input dir="auto" name="message" />
  </body>
</html>
```

- Use the HTML `dir` attribute for base direction. Do not rely on CSS `direction` as the document-level solution.
- Use `dir="auto"` for user-generated strings when direction is unknown.
- Wrap self-contained opposite-direction content with `<bdi>` or an element carrying the correct `dir`. This includes email, URLs, phone numbers, Latin product codes, times, and mixed-price labels.
- Keep DOM/source order semantic. Never manually reverse arrays or strings to make RTL “look right.”
- Mirror directional navigation and layout, but do not mirror universal or non-directional symbols. A play icon, checkmark, media controls, logo, clock, and most brand marks keep their normal form. Back/forward arrows and progress direction should follow locale meaning.

### Logical CSS only for directional spacing

```css
.card {
  padding-inline: clamp(1rem, 3vw, 2rem);
  border-inline-start: 1px solid var(--border);
  text-align: start;
}

.icon-label { margin-inline-start: .75rem; }
.drawer { inset-inline-end: 0; }
.next-arrow { transform: scaleX(var(--direction-sign, 1)); }
[dir="rtl"] { --direction-sign: -1; }
```

Prefer `inline-start/end`, `block-start/end`, `margin-inline`, `padding-inline`, `inset-inline`, and `border-inline`. MDN's [logical properties guide](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Logical_properties_and_values) explains why physical left/right properties fail across writing directions.

### Bilingual layout patterns

Choose one pattern and state it in the brief:

1. **Locale switch:** one language at a time; strongest for products and long content.
2. **Paired editorial columns:** Arabic at inline-start and Latin at inline-end, with matched concepts rather than forced line-for-line alignment.
3. **Arabic primary + Latin metadata:** Arabic owns hierarchy; Latin is used for edition numbers, coordinates, dates, or brand signatures.
4. **Interleaved poster:** short display phrases in both scripts; only for low-density marketing compositions, never forms or dense product UI.

Do not show full duplicated paragraphs side by side on narrow screens. Stack blocks and preserve language labels and reading order.

## 5. Heritage art-direction lanes

### Lane A: Islamic geometry, arabesque, and calligraphy

The Metropolitan Museum identifies geometry, vegetal ornament, and calligraphy as the three major nonfigural systems. Its geometric overview describes patterns generated from circles, squares, stars, and polygons, combined through repetition and interlace: [Geometric Patterns in Islamic Art](https://www.metmuseum.org/essays/geometric-patterns-in-islamic-art). The V&A emphasizes that decorated calligraphy must preserve clarity and proportionality: [Calligraphy in Islamic Art](https://www.vam.ac.uk/articles/calligraphy-in-islamic-art).

Use this construction grammar:

- Pick one grid family: 4-fold/square, 6-fold/hexagonal, 8-point star, or 10/12-fold only when the source supports it.
- Build a repeat unit from real geometry. Do not scatter random stars and diamonds.
- Crop the pattern at edges to imply continuation; avoid framing every component with a full tile.
- Use ornament as structure: divider, mask, aperture, grid guide, border rhythm, shadow perforation, or reveal layer.
- Combine at most two of geometry, vegetal arabesque, and calligraphy in one viewport.
- Let the pattern scale breathe. One large low-contrast field is usually stronger than many small busy tiles.
- Respect regional specificity. Maghrebi zellij, Mamluk stonework, Ottoman arabesque, Persian tilework, and Gulf architectural screens are not interchangeable skins.
- For mosque-like or sacred references, name the source and avoid turning religious architecture into a generic luxury signal.

Calligraphy rules:

- Every phrase must be provided by the user or verified by a fluent reviewer.
- Never fabricate Qur'anic verses, divine names, shahada text, or pseudo-Arabic for decoration.
- Never place sacred text on floors, footwear, disposable packaging, draggable UI, distorted masks, or surfaces that can be cropped disrespectfully.
- Preserve reading and joining. Do not stretch individual letters with CSS; use commissioned lettering or a font designed for the treatment.

### Lane B: Pharaonic and Nile visual language

Use ancient Egyptian motifs as a researched system rather than tourist shorthand. The Met documents lotus as a symbol of Upper Egypt and rebirth, papyrus as the heraldic plant of Lower Egypt, their combination as unification, and temple decoration as an ordered natural/cosmic system: [Papyrus in Ancient Egypt](https://www.metmuseum.org/essays/papyrus-in-ancient-egypt), [Temple of Dendur decoration](https://www.metmuseum.org/essays/temple-of-dendur-cult-and-decoration).

Construction grammar:

- Prefer lotus/papyrus capitals, sun-disk arcs, wing spans, carved registers, framed bands, grid-like relief fields, and stone/pigment material cues.
- Use axial symmetry, procession, stacked registers, and monumental flat planes as compositional principles.
- Translate carved relief into shallow emboss/deboss, edge lighting, occlusion, or scroll-revealed incisions.
- Use palettes derived from limestone/sandstone, carbon black, mineral blue/green, red ochre, and restrained gold. Egyptian blue was a real manufactured pigment; avoid neon “ancient Egypt” palettes. See the Met's [Egyptian painting materials](https://www.metmuseum.org/perspectives/paint-like-an-egyptian).
- Use hieroglyphs only when copied accurately from a cited object or supplied text. Decorative pseudo-hieroglyphs may be abstracted beyond legibility, but must never be presented as a translation or historical statement.
- Do not default to pyramids, Tutankhamun masks, scarabs, and sphinx silhouettes. One sourced motif with strong material logic is more credible.
- Keep modern Egyptian identity distinct from ancient Egyptian art. Do not impose Pharaonic styling on an Egyptian brand unless the brief calls for heritage.

### Lane C: Desert culture and Al Sadu

UNESCO describes Al Sadu as Bedouin weaving with narrow horizontal or vertical bands of geometric designs and a traditional palette of black, white, brown, beige, and red: [Al Sadu nomination record](https://ich.unesco.org/doc/src/17330-EN.pdf). Treat it as living cultural heritage, not a generic “tribal” texture.

Construction grammar:

- Work with stripes, stepped diamonds, triangles, narrow bands, loom rhythm, fringe, wool fiber, and repeated linear cadence.
- Build the page grid from woven bands: a narrow patterned rail can set alignment for headings, section numbers, and media.
- Use sand as material and light behavior, not an orange gradient. Consider wind-softened edges, long shadows, heat haze, granular masks, dusk indigo, stone, palm fiber, tent cloth, and brushed metal.
- Use the UNESCO palette as a historical starting point, then adapt only with a documented regional or brand rationale.
- Attribute the craft and region when it materially shapes the work. Do not label all North African, Levantine, Gulf, Nubian, Amazigh, or Bedouin patterns as one “Arabian” style.
- Avoid camel/palm/dune icon bundles. Express desert civilization through material intelligence, navigation, hospitality, horizon, astronomy, water, shade, and craft.

### Lane D: Contemporary Arabic

Use when the product is technology, finance, mobility, media, fashion, or a modern institution that does not need overt heritage.

- Let Arabic typography carry the identity.
- Use one local signal: a custom wordmark rhythm, regional color memory, architectural proportion, map geometry, photography, or material.
- Contemporary Arabic does not mean gold-on-black luxury, neon futurism, or an Islamic pattern on every card.
- Prove regional relevance through content, casting, language quality, and interaction details before ornament.

## 6. Hero architectures for Arabic mode

Choose one architecture; do not blend all six.

### A. The Arabic typographic monument

One short Arabic phrase occupies 45-70% of the viewport. A low-contrast pattern or material field sits behind it. Best for culture, editorial, fashion, and institutional launches.

### B. The inscription aperture

Content appears through a geometric, arch-derived, carved, or woven aperture. The aperture is a mask and spatial device, not a literal mosque window pasted into the page.

### C. The bilingual editorial split

Arabic owns the dominant side and Latin provides compact metadata on the opposite edge. Use asymmetric balance with semantic reading order.

### D. The heritage material close-up

Macro photography or a generated material study of stone relief, textile, paper, ceramic, wood inlay, or desert surface becomes the focal image. Text remains minimal and live.

### E. The horizontal journey

An RTL timeline or cinematic strip begins on the right and travels toward the left. Best for place, history, craft process, and event storytelling. Provide equivalent keyboard and reduced-motion behavior.

### F. The contemporary data constellation

Maps, coordinates, statistics, or network points form the hero. Arabic typography and locale-aware numbers provide identity without forced heritage motifs.

Hero quality constraints:

- One focal device only: either monumental type, aperture, material, journey, or data field.
- Keep Arabic CTA labels direct and natural. Avoid literal translations of English marketing cliches.
- Do not compress Arabic hero line-height below the point where dots or diacritics collide.
- Pattern opacity behind text usually stays below 8-14%, unless the pattern is the sole focal device.
- Verify the entire hero at 360x800, 768x1024, 1440x900, and with 200% text zoom.

## 7. Sections and component translation

- Replace generic feature-card repetition with editorial bands, numbered registers, material cutaways, staggered archives, or pattern-derived grids.
- For stats, preserve numeric LTR islands and put the Arabic unit/label in the correct semantic order.
- For timelines, RTL does not mean reversing chronological data in the DOM. Use semantic order and direction-aware visual placement.
- Forms use start-aligned labels, `dir="auto"` for free text, clear required/error states, and stable phone/country-code composition.
- Tables require deliberate column order, horizontal-scroll origin, and mixed-direction testing. Financial figures need tabular numerals.
- Icon+text rows must use logical gaps and directional icon review.
- Navigation locale switchers should display native language names, for example `العربية` and `English`, without flags as language proxies.
- Footer legal text, addresses, map coordinates, registration numbers, and social handles need explicit bidi review.

## 8. Motion language

Motion can borrow from the selected cultural system without animating the culture as a gimmick.

- **Geometry:** reveal from construction lines to full pattern; rotate only the generating grid, not every tile; use slow phase shifts.
- **Arabesque:** grow along paths with restrained stroke reveal; do not simulate handwriting for sacred or unverified text.
- **Relief:** use light sweep, depth interpolation, and occlusion to reveal carving.
- **Al Sadu:** move by band, shuttle, or weave cadence; avoid jittery “tribal” effects.
- **Desert:** granular dissolve, shadow migration, or horizon parallax; avoid constant particle storms.
- **Arabic type:** reveal by line, word, or masked phrase. Never split into isolated letters in a way that breaks joining. DOM text must remain intact for accessibility.
- RTL carousels, marquees, progress bars, drag physics, and directional transitions must start from the locale-expected edge and be tested with keyboard navigation.
- All motion remains subordinate to the parent skill's performance and reduced-motion rules.

## 9. Image generation and brand-kit prompts

When the parent skill generates images, prompts must include:

1. Arabic language and exact verified text, or an instruction to leave a clean live-text area rather than rendering copy.
2. Named regional/cultural source.
3. One heritage lane and intensity.
4. Material, construction grammar, palette, and composition.
5. Exclusions that prevent stereotype bundles, fake script, sacred text, and mixed civilizations.
6. Implementation-friendly separation between content, ornament, and background.

Prompt scaffold:

```text
Arabic-first [deliverable] for [brand/context], RTL composition.
Primary cultural source: [specific place/object/craft/period].
Heritage lane: [lane], intensity [trace/accent/immersive].
Use [construction grammar] with [materials] and [palette].
Arabic typography should feel [Kufi/Naskh/contemporary], with a clear live-text zone.
One focal device: [device]. Editorial, contemporary, culturally grounded.
Exclude pseudo-Arabic, unreadable generated text, sacred phrases, generic lanterns,
camel/pyramid/mosque collage, gold-on-black cliche, and mixed regional motifs.
```

For logos, never make a mosque dome, crescent, pyramid, falcon, camel, or Arabic initial the automatic solution. Start from brand strategy and test originality, small-size legibility, script joining, and bilingual lockups.

## 10. Accessibility, performance, and verification gate

Arabic mode is not complete until every check passes.

### Language and bidi

- [ ] Root `lang` and `dir` reflect the active locale.
- [ ] Mixed Arabic/Latin strings, numbers, prices, dates, URLs, email, and phone numbers render correctly.
- [ ] User-generated fields use appropriate direction detection.
- [ ] DOM order is semantic; no string or data-array reversal hacks.
- [ ] Locale switch preserves route/state where the product requires it.

### Typography

- [ ] Arabic glyphs join correctly at all weights.
- [ ] Diacritics, dots, punctuation, and Arabic-Indic/Latin numerals were tested.
- [ ] No clipping at the top/bottom of inputs, buttons, badges, or line boxes.
- [ ] Arabic heading wrapping was reviewed by meaning, not only geometry.
- [ ] Web fonts are licensed, subset responsibly, preloaded only when critical, and use a fallback that does not cause destructive layout shift.

### Layout and interaction

- [ ] Directional spacing uses logical properties.
- [ ] Back/forward, carousel, drawer, breadcrumb, timeline, and progress direction match the locale.
- [ ] Non-directional icons and brand marks are not accidentally mirrored.
- [ ] Keyboard order, focus order, screen-reader labels, and touch targets remain correct.
- [ ] Responsive checks cover small mobile, tablet, desktop, 200% zoom, and long Arabic strings.

### Cultural quality

- [ ] One primary heritage lane is identifiable.
- [ ] Every historical motif has a named source or is explicitly abstract/non-semantic.
- [ ] No sacred or unverified text is used as decoration.
- [ ] Regional crafts and symbols are not mislabeled or blended without rationale.
- [ ] Ornament improves hierarchy or narrative; removing it would change the concept, not merely reduce decoration.

### Visual quality

- [ ] The design still works when ornament is temporarily hidden.
- [ ] Pattern contrast never harms reading.
- [ ] The result avoids “luxury Arabia” defaults: gold-on-black, lanterns, generic arches, and stock dunes.
- [ ] Arabic is visually primary when the mode is Arabic-first.
- [ ] Motion respects joining behavior and reduced-motion preferences.

If any cultural fact, phrase, or motif meaning is uncertain, label it as an open verification item instead of inventing certainty.

