# RevoGrid shared runtime

`@revolist/grid-runtime` is the MIT-licensed lifecycle and coordination layer shared by RevoGrid products. It contains
observable configuration, plugin dependencies, keyboard ownership, row-source ownership, popup coordination, and neutral
resource/field-map types. Visual controls belong to `@revolist/ui`; product policy belongs to each product.

```ts
import { CorePlugin, bindObservableProp } from '@revolist/grid-runtime';
```

Historical `Symbol.for` keys are retained so existing Pro integrations recognize the same ownership markers. Commercial
bundles externalize this package. Install one compatible version per application so constructor lookups, configuration
observers and popup services share one module instance.

Use Node 24.15+ and pnpm 11.25:

```sh
pnpm install
pnpm format:check
pnpm lint
pnpm test
pnpm build
pnpm pack
```

ESM and CommonJS entries are provided. Formatting uses Prettier with a 120-character print width; ESLint requires braces
for every control-flow body and enforces a 120-character line limit. Building and packing do not publish a release.
