FROM node
RUN npm install -g ganache-cli
ENTRYPOINT ["ganache-cli", "-m", "kiss talent nerve fossil equip fault exile execute train wrist misery diet","-h", "0.0.0.0"]
