import json
import boto3
import os

voice_wss_url = os.environ.get('voice_wss_url')

def lambda_handler(event, context):
    print('event: ', event)

    print('wss_url: ', voice_wss_url)
    
    return {
        'statusCode': 200,
        'info': json.dumps({
            'wss_url': voice_wss_url
        })
    }
