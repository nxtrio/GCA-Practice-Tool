export class OutputCollector {
  readonly limitBytes: number;
  private readonly chunks: Buffer[] = [];
  private capturedBytes = 0;
  private observedBytes = 0;
  private exceeded = false;

  constructor(limitBytes: number) {
    if (!Number.isSafeInteger(limitBytes) || limitBytes <= 0) {
      throw new RangeError("Output limit must be a positive safe integer.");
    }
    this.limitBytes = limitBytes;
  }

  /** Returns true only for the append that first exceeds the configured limit. */
  append(chunk: Buffer | string): boolean {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    this.observedBytes += buffer.length;

    const remaining = this.limitBytes - this.capturedBytes;
    if (remaining > 0) {
      // Copy the bounded slice so a small capture never retains a much larger
      // chunk's backing allocation after an output flood.
      const captured = Buffer.from(buffer.subarray(0, remaining));
      this.chunks.push(captured);
      this.capturedBytes += captured.length;
    }

    const firstExceeded = !this.exceeded && this.observedBytes > this.limitBytes;
    if (firstExceeded) {
      this.exceeded = true;
    }
    return firstExceeded;
  }

  get byteLength(): number {
    return this.capturedBytes;
  }

  get totalObservedBytes(): number {
    return this.observedBytes;
  }

  get limitExceeded(): boolean {
    return this.exceeded;
  }

  toBuffer(): Buffer {
    return Buffer.concat(this.chunks, this.capturedBytes);
  }

  toString(encoding: BufferEncoding = "utf8"): string {
    return this.toBuffer().toString(encoding);
  }
}
