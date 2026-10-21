FROM node:24-bookworm-slim
WORKDIR /app
COPY --chown=node:node . .
RUN mkdir -p /app/data && chown node:node /app/data
USER node
ENV PORT=8787 DATA_DIR=/app/data
EXPOSE 8787
CMD ["node", "server.mjs"]
