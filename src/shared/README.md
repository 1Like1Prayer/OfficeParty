# shared/

Copied verbatim from `OfficePartyBE/src/shared/`. These files are the wire
contract; edit them in the backend and copy them across, never the other way.

    cp -R ../OfficePartyBE/src/shared/{constants.ts,protocol.ts,games} src/shared/

`PROTOCOL_VERSION` in `constants.ts` is checked in the socket handshake — if it
drifts from the server the namespace refuses the connection with
`protocol:mismatch`.
