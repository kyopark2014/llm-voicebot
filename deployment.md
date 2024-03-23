# 인프라 설치하기

## Bedrock 사용 권한 설정하기

LLM으로 Anthropic의 Claude3을 사용하기 위하여, Amazon Bedrock의 Virginia(us-east-1)와 Oregon(us-west-2) 리전을 사용합니다. [Model access - Virginia](https://us-east-1.console.aws.amazon.com/bedrock/home?region=us-east-1#/modelaccess)와  [Model access - Oregon](https://us-west-2.console.aws.amazon.com/bedrock/home?region=us-west-2#/modelaccess)에 접속한후, [Edit]를 선택하여 모든 모델을 사용할 수 있도록 설정합니다. 특히, Claude Sonet과 Haiku는 반드시 사용할 수 있어야 합니다. 

![image](https://github.com/kyopark2014/demo-ai-dansing-robot/assets/52392004/8bd8978e-5906-4d8c-93b0-b316976307e2)


## CDK를 이용한 인프라 설치하기

여기서는 [AWS Cloud9](https://aws.amazon.com/ko/cloud9/)에서 [AWS CDK](https://aws.amazon.com/ko/cdk/)를 이용하여 인프라를 설치합니다. 또한 편의상 서울 리전을 통해 실습합니다.

1) [Cloud9 Console](https://ap-northeast-2.console.aws.amazon.com/cloud9control/home?region=ap-northeast-2#/create)에 접속하여 [Create environment]-[Name]에서 “chatbot”으로 이름을 입력하고, EC2 instance는 “m5.large”를 선택합니다. 나머지는 기본값을 유지하고, 하단으로 스크롤하여 [Create]를 선택합니다.

![image](https://github.com/kyopark2014/demo-ai-dansing-robot/assets/52392004/807e3712-d98f-4359-9c79-0ea8359861ea)

2) [Environment](https://ap-northeast-2.console.aws.amazon.com/cloud9control/home?region=ap-northeast-2#/)에서 “chatbot”를 [Open]한 후에 아래와 같이 터미널을 실행합니다.

![image](https://github.com/kyopark2014/demo-ai-dansing-robot/assets/52392004/314d1acf-e5f6-4ba5-810c-9bc06bb4ef03)

3) EBS 크기 변경

아래와 같이 스크립트를 다운로드 합니다. 

```text
curl https://raw.githubusercontent.com/kyopark2014/technical-summary/main/resize.sh -o resize.sh
```

이후 아래 명령어로 용량을 80G로 변경합니다.
```text
chmod a+rx resize.sh && ./resize.sh 80
```


4) 소스를 다운로드합니다.

```java
git clone https://github.com/kyopark2014/demo-ai-dansing-robot
```

5) cdk 폴더로 이동하여 필요한 라이브러리를 설치합니다.

```java
cd demo-ai-dansing-robot/cdk-dansing-robot/ && npm install
```

7) CDK 사용을 위해 Boostraping을 수행합니다.

아래 명령어로 Account ID를 확인합니다.

```java
aws sts get-caller-identity --query Account --output text
```

아래와 같이 bootstrap을 수행합니다. 여기서 "account-id"는 상기 명령어로 확인한 12자리의 Account ID입니다. bootstrap 1회만 수행하면 되므로, 기존에 cdk를 사용하고 있었다면 bootstrap은 건너뛰어도 됩니다.

```java
cdk bootstrap aws://[account-id]/ap-northeast-2
```

8) 아래 명령어로 인프라를 설치합니다.

```java
cdk deploy --all
```

인프라가 설치가 되면 아래와 같은 Output을 확인할 수 있습니다. 여기에서는 접속하는 URL인 WebUrlforstreamchatbot과 CloudFront 주소를 distributionDomainNamefordemodansingrobotl로 알 수 있습니다.


![image](https://github.com/kyopark2014/demo-ai-dansing-robot/assets/52392004/f39623bc-6574-4e62-abfd-b0605d42436c)

9) NAT 설정

추가 예정 

10) Output의 WebUrlforstreamchatbot의 URL로 접속합니다. Voice Interpreter와 사용자 ID를 이용해 데이터를 교환합니다. 따라서 사용자 ID로 "robot"라고 입력합니다.

## Voice Interpreter 

Voice Interpreter는 음성으로부터 Text를 추출합니다. 이때 [Amazon Transcribe Streaming SDK](https://github.com/awslabs/amazon-transcribe-streaming-sdk)을 활용하였습니다. 아래를 실행하기 전에 requirements를 설치합니다.

```text
pip install -r requirements.txt
```

interpreter 폴더로 이동하여, [config.ini](./interpreter/config.ini) 파일을 연 후에 아래의 내용을 업데이트 합니다. url은 Output의 distributionDomainNamefordemodansingrobotl의 주소로 업데이트 합니다.

```text
[system]
url = https://d1r17qhj4m3dnc.cloudfront.net/redis
userId = robot
```

이후 아래와 같이 실행합니다.

```text
python mic_main.py
```
