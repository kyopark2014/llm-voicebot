import boto3
import os
import time
import re
import base64
import boto3
import uuid
import json
import redis
import traceback

# for Redis
redisAddress = os.environ.get('redisAddress')
redisPort = os.environ.get('redisPort')

try: 
    redis_client = redis.Redis(host=redisAddress, port=redisPort, db=0, charset="utf-8", decode_responses=True)    
except Exception:
    err_msg = traceback.format_exc()
    print('error message: ', err_msg)                    
    raise Exception ("Not able to request to LLM")

requestId = str(uuid.uuid4())     
def lambda_handler(event, context):
    print('event: ', json.dumps(event))
    
    global requestId
    
    userId = event['userId']        
    query = event['query']
    state = event['state']    
        
    msg = {
        "userId": userId,
        "requestId": requestId,
        "query": query,
        "state": state
    }
    
    if state == 'completed':
        requestId = str(uuid.uuid4())  
    
    channel = f"{userId}"   
    try: 
        redis_client.publish(channel=channel, message=json.dumps(msg))
        print('successfully published: ', json.dumps(msg))
    
    except Exception:
        err_msg = traceback.format_exc()
        print('error message: ', err_msg)                    
        raise Exception ("Not able to request to LLM")
        
    msg = "success"
    
    return {
        "isBase64Encoded": False,
        'statusCode': 200,
        'body': json.dumps({ 
            "channel": channel,
            "query": json.dumps(query)
        })
    }