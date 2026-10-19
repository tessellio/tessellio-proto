# Tessellio Proto

The wire schemas for the **Tessellio** screen codec.

The codec's payload grammar — the op stream, the DEFLATE envelope, the
coverage rules — is defined by the codec specification, not here. This
package defines the *envelope* the codec's updates travel in: the identity of
an update, the part it is, and the regions it carries.

## The schema

[`proto/tessellio/v1/tessellio.proto`](proto/tessellio/v1/tessellio.proto)
declares:

- `Codec` — the codecs this schema can carry. There is one: the codec is
  exact at wire fidelity, so there is nothing to select.
- `Region` — a rectangle of the surface, and the op stream that paints it.
- `Update` — one part of one update. An update is either self-contained
  (`base_update_id == 0`) or chained (`base_update_id > 0`), and it is applied
  whole: every part of it, or none.

Field numbers are a wire contract: never reuse one, never renumber an
existing one.

## Generating the bindings

```sh
npm install
npm run generate          # write the TypeScript bindings
npm run generate:check    # fail if the committed bindings are stale
```

The generated file is committed, so a consumer needs no toolchain.

## Licence

PolyForm Noncommercial License 1.0.0. See [LICENSE](LICENSE).
