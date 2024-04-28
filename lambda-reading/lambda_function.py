import boto3
import os
import time
import re
import base64
import boto3
import uuid
import json

from langchain.prompts import PromptTemplate
from botocore.config import Config
from PIL import Image
from io import BytesIO
from urllib import parse
import traceback
from langchain.callbacks.streaming_stdout import StreamingStdOutCallbackHandler

from langchain_core.prompts import MessagesPlaceholder, ChatPromptTemplate
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_aws import ChatBedrock

bucket = os.environ.get('s3_bucket') # bucket name
s3_prefix = os.environ.get('s3_prefix')
historyTableName = os.environ.get('historyTableName')
speech_prefix = 'speech/'

s3 = boto3.client('s3')
polly = boto3.client('polly')
   
HUMAN_PROMPT = "\n\nHuman:"
AI_PROMPT = "\n\nAssistant:"

selected_LLM = 0
profile_of_LLMs = json.loads(os.environ.get('profile_of_LLMs'))

def get_chat(profile_of_LLMs, selected_LLM):
    profile = profile_of_LLMs[selected_LLM]
    bedrock_region =  profile['bedrock_region']
    modelId = profile['model_id']
    print(f'LLM: {selected_LLM}, bedrock_region: {bedrock_region}, modelId: {modelId}')
    maxOutputTokens = int(profile['maxOutputTokens'])
                          
    # bedrock   
    boto3_bedrock = boto3.client(
        service_name='bedrock-runtime',
        region_name=bedrock_region,
        config=Config(
            retries = {
                'max_attempts': 30
            }            
        )
    )
    parameters = {
        "max_tokens":maxOutputTokens,     
        "temperature":0.1,
        "top_k":250,
        "top_p":0.9,
        "stop_sequences": [HUMAN_PROMPT]
    }
    # print('parameters: ', parameters)

    chat = ChatBedrock(   
        model_id=modelId,
        client=boto3_bedrock, 
        model_kwargs=parameters,
    )     
    
    return chat

def extract_text(chat, img_base64):    
    query = "텍스트를 추출해서 utf8 형태의 한국어로 답변하세요. <result> tag를 붙여주세요."
    
    messages = [
        HumanMessage(
            content=[
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/png;base64,{img_base64}", 
                    },
                },
                {
                    "type": "text", "text": query
                },
            ]
        )
    ]
    
    try: 
        result = chat.invoke(messages)
        
        extracted_text = result.content
        print('result of text extraction from an image: ', extracted_text)
    except Exception:
        err_msg = traceback.format_exc()
        print('error message: ', err_msg)                    
        raise Exception ("Not able to request to LLM")
    
    return extracted_text
    
def lambda_handler(event, context):
    # print(event)
    
    image_content = event["body"]
    start_time = time.time()
    
    img = Image.open(BytesIO(base64.b64decode(image_content)))
    
    width, height = img.size 
    print(f"width: {width}, height: {height}, size: {width*height}")
    
    isResized = False
    while(width*height > 5242880):                    
        width = int(width/2)
        height = int(height/2)
        isResized = True
    print(f"width: {width}, height: {height}, size: {width*height}")
    
    if isResized:
        img = img.resize((width, height))
                
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    img_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
    
    # extract text from the image
    chat = get_chat(profile_of_LLMs, selected_LLM)
    
    text = extract_text(chat, img_base64)
    extracted_text = text[text.find('<result>')+8:len(text)-9] # remove <result> tag
    print('extracted_text: ', extracted_text)
    
    end_time = time.time()
    time_for_estimation = end_time - start_time
    
    return {
        "isBase64Encoded": False,
        'statusCode': 200,
        'body': json.dumps({            
            "msg": extracted_text,
            "time_taken": str(time_for_estimation)
        })
    }