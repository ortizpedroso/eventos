# Apple Wallet e Google Wallet — fase futura

## Estado atual (build patamar-completo)

- Ingresso em **PDF/HTML** e tela **QR** na conta do comprador
- Botão **“Adicionar à Carteira”** na UI com estado **Em breve** (desabilitado)

## Requisitos para Wallet funcional

### Apple Wallet (PassKit)

- Conta **Apple Developer** (paga)
- **Pass Type ID** e certificado `.p12`
- Servidor para assinar passes (`pass.json` + imagens)
- Variáveis futuras sugeridas:
  - `APPLE_WALLET_PASS_TYPE_ID`
  - `APPLE_WALLET_TEAM_ID`
  - `APPLE_WALLET_CERT_PATH`
  - `APPLE_WALLET_CERT_PASSWORD`

### Google Wallet (Google Pay API for Passes)

- Projeto Google Cloud + **Google Wallet API** habilitada
- Conta de emissor (issuer ID)
- Chave de conta de serviço JSON
- Variáveis futuras:
  - `GOOGLE_WALLET_ISSUER_ID`
  - `GOOGLE_WALLET_SERVICE_ACCOUNT_JSON`

## Conteúdo do pass (planejado)

- Nome do evento, data, local
- Nome do participante
- QR Code / código da portaria
- Cor da marca EventosBR (esmeralda)

## Referências

- [Apple Wallet Developer Guide](https://developer.apple.com/wallet/)
- [Google Wallet API](https://developers.google.com/wallet)
