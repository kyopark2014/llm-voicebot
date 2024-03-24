# Refernce: Amazon Transcribe Streaming SDK: https://github.com/awslabs/amazon-transcribe-streaming-sdk

import asyncio
import sounddevice
import requests
import configparser
from amazon_transcribe.client import TranscribeStreamingClient
from amazon_transcribe.handlers import TranscriptResultStreamHandler
from amazon_transcribe.model import TranscriptEvent

config = configparser.ConfigParser()    
config.read('config.ini', encoding='utf-8') 

config.sections()

url = config['system']['url'] 
print('url: ', url)
userId = config['system']['userId']  
print('userId: ', userId)

class MyEventHandler(TranscriptResultStreamHandler):
    async def handle_transcript_event(self, transcript_event: TranscriptEvent):
        # This handler can be implemented to handle transcriptions as needed.
        # Here's an example to get started.
        results = transcript_event.transcript.results
                       
        for result in results:       
            if result.is_partial == False:
                for alt in result.alternatives:
                    print('----> ', alt.transcript)
                    
                    msg = {
                        "userId": userId,
                        "query": alt.transcript,
                        "state": "completed"
                    }
                    resp = requests.post(url, json=msg)
                    
                    print('resp: ', resp)
            else:
                for alt in result.alternatives:
                    print(alt.transcript)    
                    
                    msg = {
                        "userId": userId,
                        "query": alt.transcript,
                        "state": "proceeding"
                    }
                    resp = requests.post(url, json=msg)

async def mic_stream():
    # This function wraps the raw input stream from the microphone forwarding
    # the blocks to an asyncio.Queue.
    loop = asyncio.get_event_loop()
    input_queue = asyncio.Queue()

    def callback(indata, frame_count, time_info, status):
        loop.call_soon_threadsafe(input_queue.put_nowait, (bytes(indata), status))

    # Be sure to use the correct parameters for the audio stream that matches
    # the audio formats described for the source language you'll be using:
    # https://docs.aws.amazon.com/transcribe/latest/dg/streaming.html
    stream = sounddevice.RawInputStream(
        channels=1,
        samplerate=16000,
        callback=callback,
        blocksize=1024 * 2,
        dtype="int16",
    )
    # Initiate the audio stream and asynchronously yield the audio chunks
    # as they become available.
    with stream:
        while True:
            indata, status = await input_queue.get()
            yield indata, status


async def write_chunks(stream):
    # This connects the raw audio chunks generator coming from the microphone
    # and passes them along to the transcription stream.
    async for chunk, status in mic_stream():
        await stream.input_stream.send_audio_event(audio_chunk=chunk)
    await stream.input_stream.end_stream()


async def basic_transcribe():
    # Setup up our client with our chosen AWS region
    client = TranscribeStreamingClient(region="ap-northeast-2")

    # Start transcription to generate our async stream
    stream = await client.start_stream_transcription(
        language_code="ko-KR",
        media_sample_rate_hz=16000,
        media_encoding="pcm",
    )

    # Instantiate our handler and start processing events
    handler = MyEventHandler(stream.output_stream)
    await asyncio.gather(write_chunks(stream), handler.handle_events())

if __name__ == "__main__":
    loop = asyncio.get_event_loop()
    loop.run_until_complete(basic_transcribe())
    loop.close()