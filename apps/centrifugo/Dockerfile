FROM centrifugo/centrifugo:v6
COPY docker/centrifugo.json /centrifugo/config.json
# Do not place scripts under /centrifugo — the base image can make that path non-writable (chmod fails on Railway).
COPY docker/centrifugo-entrypoint.sh /entrypoint.sh
EXPOSE 8000
ENTRYPOINT ["sh", "/entrypoint.sh"]
CMD []
