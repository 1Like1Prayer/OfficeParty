# shared/

Copied verbatim from the server, `OfficePartyV2/src/shared/`. These files are
the wire contract and the game rules. Edit them in the server and copy them
across, never the other way:

    rsync -a --delete --exclude '*.test.ts' --exclude README.md \
      ../OfficePartyV2/src/shared/ src/shared/

`PROTOCOL_VERSION` in `constants.ts` is sent in the join options. If it
drifts from the server's, the join is refused with `PROTOCOL_MISMATCH_CODE`
and the client asks the player to reload.
