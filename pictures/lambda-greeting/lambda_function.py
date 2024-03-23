import boto3
import os
import time
import re
import base64
import boto3
import uuid
import json

from botocore.config import Config
from PIL import Image
from io import BytesIO
from urllib import parse
import traceback
from langchain.callbacks.streaming_stdout import StreamingStdOutCallbackHandler

from langchain_community.chat_models import BedrockChat
from langchain_core.prompts import MessagesPlaceholder, ChatPromptTemplate
from langchain_core.messages import HumanMessage, SystemMessage

bucket = os.environ.get('s3_bucket') # bucket name
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

    chat = BedrockChat(
        model_id=modelId,
        client=boto3_bedrock, 
        streaming=True,
        callbacks=[StreamingStdOutCallbackHandler()],
        model_kwargs=parameters,
    )        
    
    return chat

def generate_greeting_message(chat, img_base64, query):    
    messages = [
        SystemMessage(content="답변은 50자 이내의 한국어로 해주세요. <result> tag를 붙여주세요."),
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
        msg = result.content

    except Exception:
        err_msg = traceback.format_exc()
        print('error message: ', err_msg)                    
        raise Exception ("Not able to request to LLM")
    
    return msg[msg.find('<result>')+8:len(msg)-9] # remove <result> tag

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
    print(event)
    
    image_content = event["body"]    
    
    start_time_for_greeting = time.time()
    
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
    
    # creating greeting message
    chat = get_chat(profile_of_LLMs, selected_LLM)    
    query = """<example> tag에 있는 예를 참조하여 그림에 있는 사람이 기분 좋아지는 멋진 인사말을 해주세요.
    <example>
    안녕. 너는 멋진 옷을 입고 왔구나.
    안녕. 기분 좋지 않은일이 있니? 그래도 힘내도 오늘 멋지게 데모를 즐기자.
    하이, 정말 멋진 날이지? 반가워!
    </example>
    """
    msg = generate_greeting_message(chat, img_base64, query)     
    print('greeting msg: ', msg)  
    
    end_time_for_greeting = time.time()
    time_for_greeting = end_time_for_greeting - start_time_for_greeting
    
    return {
        "isBase64Encoded": False,
        'statusCode': 200,
        'body': json.dumps({            
            "msg": msg,
            "time_taken": str(time_for_greeting)
        })
    }