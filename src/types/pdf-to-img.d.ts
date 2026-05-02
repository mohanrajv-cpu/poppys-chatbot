declare module 'pdf-to-img' {
  function pdf(
    data: Buffer | Uint8Array,
    options?: { scale?: number }
  ): Promise<AsyncIterable<Buffer>>;
  export { pdf };
}
