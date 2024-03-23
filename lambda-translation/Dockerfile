FROM amazon/aws-lambda-python:3.11

WORKDIR /var/task/lambda-redis

COPY lambda_function.py /var/task/
COPY test.py /var/task/   
COPY . ..

RUN /var/lang/bin/python3 -m pip install redis 

CMD ["lambda_function.lambda_handler"]