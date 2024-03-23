import json
import boto3
import traceback
import os
import base64

polly_client = boto3.client('polly')

s3_bucket = os.environ.get('s3_bucket') # bucket name

def lambda_handler(event, context):
    print('event: ', event)
    
    text = event['text']
    voiceId = event['voiceId']
    langCode = event['langCode']
    
    speed = 120
    ssml_text = f'<speak><prosody rate="{speed}%">{text}</prosody></speak>'
    
    try: 
        response = polly_client.synthesize_speech(
            Text=ssml_text,
            TextType='ssml', # 'ssml'|'text'
            Engine='neural',  # 'standard'|'neural'
            LanguageCode=langCode, 
            OutputFormat='ogg_vorbis', # 'json'|'mp3'|'ogg_vorbis'|'pcm',
            VoiceId=voiceId
            # SampleRate=16000, # "8000", "16000", "22050", and "24000".
            # SpeechMarkTypes= # 'sentence'|'ssml'|'viseme'|'word'            
        )
        
        encoded_content = base64.b64encode(response['AudioStream'].read()).decode()
        # print('encoded_content: ', encoded_content)
    except Exception:
        err_msg = traceback.format_exc()
        print('error message: ', err_msg)        
        raise Exception ("Not able to create a speech using polly")
    
    return {
        'statusCode': 200,        
        "isBase64Encoded": True,
        "headers": {
            "Content-Type": "audio/ogg"
        },
        'body': encoded_content
    }    