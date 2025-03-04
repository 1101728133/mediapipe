import {streamToUint8Array} from '../../tasks/web/genai/llm_inference/model_loading_utils';
import {LlmInferenceGraphOptions} from '../../tasks/web/genai/llm_inference/proto/llm_inference_graph_options_pb';
import {GraphRunner} from '../../web/graph_runner/graph_runner';
import {SamplerParameters} from '../../tasks/cc/genai/inference/proto/sampler_params_pb';

/**
 * We extend from a GraphRunner constructor. This ensures our mixin has
 * access to the wasmModule, among other things. The `any` type is required for
 * mixin constructors.
 */
// tslint:disable-next-line:no-any
type LibConstructor = new (...args: any[]) => GraphRunner;

/**
 * A listener that receives the newly generated partial result and an indication
 * whether the generation is complete.
 */
export type ProgressListener = (
  partialResult: string,
  done: boolean,
) => unknown;

/**
 * A listener that receives the newly generated partial results for multiple
 * responses and an indication whether the generation is complete.
 */
export type MultiResponseProgressListener = (
  partialResult: string[],
  done: boolean,
) => unknown;

/**
 * Declarations for Emscripten's WebAssembly Module behavior, so TS compiler
 * doesn't break our JS/C++ bridge.
 */
export declare interface WasmLlmInferenceModule {
  // TODO: b/398949555 - Support multi-response generation for converted LLM
  // models (.task format).
  _userProgressListener: ProgressListener | undefined;
  ccall: (
    name: string,
    type: string,
    inParams: unknown,
    outParams: unknown,
    options: unknown,
  ) => Promise<void>;
}

/**
 * An implementation of GraphRunner that provides LLM Inference Engine
 * functionality.
 * Example usage:
 * `const MediaPipeLib = SupportLlmInference(GraphRunner);`
 */
// tslint:disable-next-line:enforce-name-casing
export function SupportLlmInference<TBase extends LibConstructor>(Base: TBase) {
  return class LlmInferenceSupportedGraphRunner extends Base {
    // Some methods and properties are supposed to be private, TS has an
    // existing issue with supporting private in anonymous classes, so we use
    // old-style '_' to indicate private.
    // tslint:disable-next-line:enforce-name-casing
    _isLlmEngineProcessing = false;

    // tslint:disable-next-line:enforce-name-casing
    _startLlmEngineProcessing() {
      if (this._isLlmEngineProcessing) {
        throw new Error(
          'Cannot process because LLM inference engine is currently loading ' +
            'or processing.',
        );
      }
      this._isLlmEngineProcessing = true;
    }

    // tslint:disable-next-line:enforce-name-casing
    _endLlmEngineProcessing() {
      this._isLlmEngineProcessing = false;
    }

    /**
     * Create LLM Inference Engine for text generation.
     *
     * @param modelStream The stream object for the model to be loaded.
     * @param llmInferenceGraphOptions The settings for the LLM Inference
     *    Engine.
     */
    async createLlmInferenceEngine(
      modelStream: ReadableStreamDefaultReader,
      llmInferenceGraphOptions: LlmInferenceGraphOptions,
    ) {
      this._startLlmEngineProcessing();
      await this.uploadToWasmFileSystem(modelStream);
      // TODO: b/398858545 - Pass llmInferenceGraphOptions to the C function.
      await (this.wasmModule as unknown as WasmLlmInferenceModule).ccall(
        'CreateLlmInferenceEngine',
        'void',
        [],
        [],
        {async: true},
      );
      this._endLlmEngineProcessing();
    }

    /**
     * Delete LLM Inference Engine.
     */
    deleteLlmInferenceEngine() {
      this._startLlmEngineProcessing();
      (this.wasmModule as unknown as WasmLlmInferenceModule).ccall(
        'DeleteLlmInferenceEngine',
        'void',
        [],
        [],
        {async: false},
      );
      this._endLlmEngineProcessing();
    }

    /**
     * Create LLM Inference Engine for text generation.
     *
     * @param text The text to process.
     * @param samplerParameters The settings for sampler, used to configure the
     *     LLM Inference sessions.
     * @return The generated text result.
     */
    async generateResponseSync(
      text: string,
      samplerParameters: SamplerParameters,
      // TODO: b/398949555 - Support multi-response generation for converted LLM
      // models (.task format).
      userProgressListener?: ProgressListener,
    ): Promise<string> {
      this._startLlmEngineProcessing();
      const result: string[] = [];
      // This additional wrapper on top of userProgressListener is to collect
      // all partial results and then to return them together as the full
      // result.
      const progressListener = (partialResult: string, done: boolean) => {
        if (partialResult) {
          // TODO: b/398904237 - Support streaming generation: use the done flag
          // to indicate the end of the generation.
          result.push(partialResult);
        }
        if (userProgressListener) {
          userProgressListener(partialResult, done);
        }
      };
      (
        this.wasmModule as unknown as WasmLlmInferenceModule
      )._userProgressListener = progressListener;
      await this.wrapStringPtrAsync(text, (textPtr: number) => {
        // TODO: b/398858545 - Pass samplerParameters to the C function.
        return (this.wasmModule as unknown as WasmLlmInferenceModule).ccall(
          'GenerateResponseSync',
          'void',
          ['number'],
          [textPtr],
          {async: true},
        );
      });
      (
        this.wasmModule as unknown as WasmLlmInferenceModule
      )._userProgressListener = undefined;
      this._endLlmEngineProcessing();
      // TODO: b/398880215 - return the generated string from the C function.
      return result.join('');
    }

    /**
     * Upload the LLM asset to the wasm file system.
     *
     * @param modelStream The stream object for the model to be uploaded.
     */
    async uploadToWasmFileSystem(
      modelStream: ReadableStreamDefaultReader,
    ): Promise<void> {
      const fileContent = await streamToUint8Array(modelStream);
      try {
        // Try to delete file as we cannot overwrite an existing file
        // using our current API.
        this.wasmModule.FS_unlink('llm.task');
      } catch {}
      this.wasmModule.FS_createDataFile(
        '/',
        'llm.task',
        fileContent,
        /* canRead= */ true,
        /* canWrite= */ false,
        /* canOwn= */ false,
      );
    }
  };
}
