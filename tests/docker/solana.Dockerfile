FROM node:lts-bullseye
WORKDIR /crypto-rpc
RUN  npm install @solana/web3.js @solana/spl-token

# Use the official Solana image
FROM solanalabs/solana:v1.10.32

# Copy keypair files to the container
COPY ./blockchain/solana/test/keypair/id.json /solana/keypair/id.json
COPY ./blockchain/solana/test/keypair/id2.json /solana/keypair/id2.json
COPY ./blockchain/solana/test/keypair/id3.json /solana/keypair/id3.json
COPY ./blockchain/solana/test/keypair/validator.json /root/.config/solana/id.json

# Add a script to start the validator and fund the addresses
COPY ./blockchain/solana/test/startSolana.sh /solana/startSolana.sh

# Make the script executable
RUN chmod +x /solana/startSolana.sh

ENTRYPOINT ["./solana/startSolana.sh"]
EXPOSE 8899
EXPOSE 8900