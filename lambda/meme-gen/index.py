import json
import boto3
import os
import requests
from PIL import Image, ImageDraw, ImageFont
from io import BytesIO
import textwrap
from datetime import datetime

s3_client = boto3.client('s3')
bedrock_client = boto3.client('bedrock-runtime')

S3_BUCKET = os.environ['S3_BUCKET']
CLOUDFRONT_DOMAIN = os.environ['CLOUDFRONT_DOMAIN']

# Popular meme templates
MEME_TEMPLATES = {
    'drake': {
        'name': 'Drake Pointing',
        'text_areas': [
            {'x': 220, 'y': 80, 'width': 200, 'height': 100},   # Top text
            {'x': 220, 'y': 230, 'width': 200, 'height': 100}   # Bottom text
        ]
    },
    'distracted_boyfriend': {
        'name': 'Distracted Boyfriend',
        'text_areas': [
            {'x': 50, 'y': 400, 'width': 150, 'height': 50},    # Girlfriend
            {'x': 200, 'y': 400, 'width': 150, 'height': 50},   # Boyfriend  
            {'x': 350, 'y': 400, 'width': 150, 'height': 50}    # Other woman
        ]
    },
    'doge': {
        'name': 'Doge',
        'text_areas': [
            {'x': 50, 'y': 50, 'width': 100, 'height': 30},     # Much
            {'x': 300, 'y': 100, 'width': 100, 'height': 30},   # Very
            {'x': 100, 'y': 200, 'width': 100, 'height': 30},   # Such
            {'x': 250, 'y': 250, 'width': 100, 'height': 30}    # Wow
        ]
    }
}

def meme_handler(event, context):
    """Generate meme based on user prompt"""
    try:
        body = json.loads(event['body']) if event.get('body') else event
        
        prompt = body.get('prompt', '')
        template = body.get('template', 'doge')  # Default to doge
        
        if not prompt:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Prompt is required'})
            }
        
        # Generate meme concept using LLM
        meme_concept = generate_meme_concept(prompt, template)
        
        # Create meme image
        image_data = create_meme_image(template, meme_concept)
        
        # Upload to S3
        timestamp = int(datetime.now().timestamp())
        filename = f"memes/{template}-{timestamp}.png"
        
        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=filename,
            Body=image_data,
            ContentType='image/png',
            CacheControl='max-age=86400'  # 24 hour cache
        )
        
        image_url = f"https://{CLOUDFRONT_DOMAIN}/{filename}"
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'imageUrl': image_url,
                'template': template,
                'concept': meme_concept
            })
        }
        
    except Exception as e:
        print(f"Error generating meme: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Failed to generate meme'})
        }

def generate_meme_concept(prompt, template):
    """Use Bedrock to generate meme text based on prompt and template"""
    try:
        template_info = MEME_TEMPLATES.get(template, MEME_TEMPLATES['doge'])
        num_text_areas = len(template_info['text_areas'])
        
        bedrock_prompt = f"""Create a funny meme using the {template_info['name']} template.
        
User request: {prompt}

Generate {num_text_areas} short, punchy text snippets that would work well for this meme template.
Each text should be maximum 10 words.
Return as JSON array: ["text1", "text2", ...]

Make it funny and relevant to: {prompt}"""

        response = bedrock_client.invoke_model(
            modelId='anthropic.claude-3-haiku-20240307-v1:0',
            body=json.dumps({
                'messages': [{'role': 'user', 'content': bedrock_prompt}],
                'max_tokens': 200,
                'temperature': 0.8,
                'anthropic_version': 'bedrock-2023-05-31'
            }),
            contentType='application/json'
        )
        
        response_body = json.loads(response['body'].read())
        meme_text = response_body['content'][0]['text']
        
        # Try to parse as JSON, fallback to simple text
        try:
            return json.loads(meme_text)
        except:
            # Fallback: split by lines or create simple structure
            lines = [line.strip() for line in meme_text.split('\n') if line.strip()]
            return lines[:num_text_areas]
            
    except Exception as e:
        print(f"Error generating meme concept: {str(e)}")
        # Fallback meme text
        return ["Such AI", "Much meme", "Very generate", "Wow"]

def create_meme_image(template, texts):
    """Create meme image with text overlays"""
    template_info = MEME_TEMPLATES.get(template, MEME_TEMPLATES['doge'])
    
    # For this demo, create a simple colored background
    # In production, you'd use actual meme template images
    width, height = 500, 400
    image = Image.new('RGB', (width, height), (255, 255, 255))
    draw = ImageDraw.Draw(image)
    
    # Create template-specific background
    if template == 'doge':
        # Yellow/orange gradient background
        for y in range(height):
            color_val = int(200 + (y / height) * 55)
            color = (255, color_val, 100)
            draw.line([(0, y), (width, y)], fill=color)
    elif template == 'drake':
        # Blue background
        draw.rectangle([0, 0, width, height], fill=(64, 128, 255))
    else:
        # Default gradient
        for y in range(height):
            color_val = int(150 + (y / height) * 105)
            color = (color_val, color_val, 255)
            draw.line([(0, y), (width, y)], fill=color)
    
    # Add text overlays
    try:
        font_large = ImageFont.truetype('/opt/fonts/arial-bold.ttf', 32)
        font_small = ImageFont.truetype('/opt/fonts/arial.ttf', 24)
    except:
        font_large = ImageFont.load_default()
        font_small = ImageFont.load_default()
    
    text_areas = template_info['text_areas']
    
    for i, text in enumerate(texts):
        if i >= len(text_areas):
            break
            
        area = text_areas[i]
        
        # Choose font size based on text length
        font = font_small if len(text) > 15 else font_large
        
        # Wrap text to fit area
        wrapped_text = textwrap.fill(text, width=20)
        
        # Calculate text position (center in area)
        text_bbox = draw.textbbox((0, 0), wrapped_text, font=font)
        text_width = text_bbox[2] - text_bbox[0]
        text_height = text_bbox[3] - text_bbox[1]
        
        x = area['x'] + (area['width'] - text_width) // 2
        y = area['y'] + (area['height'] - text_height) // 2
        
        # Draw text with outline for visibility
        outline_color = 'black'
        text_color = 'white'
        
        # Draw outline
        for dx in [-2, -1, 0, 1, 2]:
            for dy in [-2, -1, 0, 1, 2]:
                if dx != 0 or dy != 0:
                    draw.text((x + dx, y + dy), wrapped_text, 
                             font=font, fill=outline_color)
        
        # Draw main text
        draw.text((x, y), wrapped_text, font=font, fill=text_color)
    
    # Convert to bytes
    buffer = BytesIO()
    image.save(buffer, format='PNG', optimize=True, quality=95)
    return buffer.getvalue()
