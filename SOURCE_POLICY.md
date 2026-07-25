# Source Policy

rCodexManager is distributed under the MIT License in [LICENSE](LICENSE).

The development workspace may contain local QA captures, authentication screens, generated archives, and noisy private history. Public source records are created as filtered snapshots by the publishing server during an approved release window. The filter preserves application source, tests, documentation, manifests, skills, and GitHub workflows while excluding credentials, authentication backups, QR codes, local node data, build output, caches, and machine-only visual evidence.

A public Git Tag identifies one reproducible source snapshot. GitHub Actions builds desktop candidates and the Linux headless archive from that Tag; installers are never promoted from ad hoc packages created on a development Mac.
