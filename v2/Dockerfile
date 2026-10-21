FROM node:24-bookworm-slim
WORKDIR /app
COPY --chown=node:node v2/ .
RUN mkdir -p /app/data && chown node:node /app/data
ENV PORT=8787 DATA_DIR=/app/data
EXPOSE 8787
CMD ["node", "start-production.mjs"]
