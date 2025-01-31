import { Message } from '@/types/chat';
import { OpenAIModel } from '@/types/openai';

import { AZURE_DEPLOYMENT_ID, OPENAI_API_HOST, OPENAI_API_TYPE, OPENAI_API_VERSION, OPENAI_ORGANIZATION, STREAM_TYPE } from '../app/const';

import {
  ParsedEvent,
  ReconnectInterval,
  createParser,
} from 'eventsource-parser';

export class OpenAIError extends Error {
  type: string;
  param: string;
  code: string;

  constructor(message: string, type: string, param: string, code: string) {
    super(message);
    this.name = 'OpenAIError';
    this.type = type;
    this.param = param;
    this.code = code;
  }
}

export const OpenAIStream = async (
  model: OpenAIModel,
  systemPrompt: string,
  temperature : number,
  key: string,
  messages: Message[],
) => {
  let url = `${OPENAI_API_HOST}/v1/chat/completions`;
  if (OPENAI_API_TYPE === 'azure') {
    url = `${OPENAI_API_HOST}/openai/deployments/${AZURE_DEPLOYMENT_ID}/chat/completions?api-version=${OPENAI_API_VERSION}`;
  }
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(OPENAI_API_TYPE === 'openai' && {
        Authorization: `Bearer ${key ? key : process.env.OPENAI_API_KEY}`
      }),
      ...(OPENAI_API_TYPE === 'azure' && {
        'api-key': `${key ? key : process.env.OPENAI_API_KEY}`
      }),
      ...((OPENAI_API_TYPE === 'openai' && OPENAI_ORGANIZATION) && {
        'OpenAI-Organization': OPENAI_ORGANIZATION,
      }),
    },
    method: 'POST',
    body: JSON.stringify({
      ...(OPENAI_API_TYPE === 'openai' && {model: model.id}),
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        ...messages,
      ],
      max_tokens: 1000,
      temperature: temperature,
      stream: true,
    }),
  });

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  if (res.status !== 200) {
    const result = await res.json();
    if (result.error) {
      throw new OpenAIError(
        result.error.message,
        result.error.type,
        result.error.param,
        result.error.code,
      );
    } else {
      throw new Error(
        `OpenAI API returned an error: ${
          decoder.decode(result?.value) || result.statusText
        }`,
      );
    }
  }

  function parseArray(str: string){
    if(str.includes("}{")){
      let r = str.split("}{")
      return r.map(s=>{
        if (s.indexOf('{')!=0){
          s='{'+s;
        }
        if(s.lastIndexOf("}")!=s.length-1){
          s+='}'
        }
        return JSON.parse(s)
      })
    }else if(str){
      return [JSON.parse(str)]
    }else{
      return []
    }
  }
  if(STREAM_TYPE==''){
    return new ReadableStream({
      async start(controller) {
        const onParse = (event: ParsedEvent | ReconnectInterval) => {
          console.log('event',event)
          if (event.type === 'event') {
            const data = event.data;
  
            try {
              const json = JSON.parse(data);
              if (json.choices[0].finish_reason != null) {
                controller.close();
                return;
              }
              const text = json.choices[0].delta.content;
              const queue = encoder.encode(text);
              controller.enqueue(queue);
            } catch (e) {
              controller.error(e);
            }
          }
        };
  
        const parser = createParser(onParse);
  
        for await (const chunk of res.body as any) {
          console.log(decoder.decode(chunk))
          parser.feed(decoder.decode(chunk));
        }
      },
    });
  }else{
    // return stream;
    return  new ReadableStream({
      start(controller) {
        const body = res.body as any
        const reader = body.getReader();
        const pump = () => {
          return reader.read().then((v: any) => {
            const done = v.done as Boolean
            const value = decoder.decode(v.value as any)
            const array = parseArray(value)
            if (done) {
              controller.close();
              return;
            }
            array.forEach(json=>{
              const text = json.choices[0].delta.content
              if(text){
                controller.enqueue(encoder.encode(text));
              }
            })
        
            return pump();
          });
        }
        return pump();
        
      }
    })
  }


  
};
