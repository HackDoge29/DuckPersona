import json
import boto3
import base64
import os
import hashlib
from datetime import datetime
from PIL import Image, ImageDraw, ImageFont
import requests
from io import BytesIO

s3_client = boto3.client('s3')
bedrock_client = boto3.client('bedrock-runtime')

S3_BUCKET = os.environ.get('S3_BUCKET', 'your-bucket-name')
CLOUDFRONT_DOMAIN = os.environ.get('CLOUDFRONT_DOMAIN', 'your-cloudfront-domain.com')

# Duck trait mappings
RARITY_COLORS = {
    1: '#8B4513',  # Common - Brown
    2: '#32CD32',  # Uncommon - Green  
    3: '#4169E1',  # Rare - Blue
    4: '#9932CC',  # Epic - Purple
    5: '#FFD700'   # Legendary - Gold
}

SPECIES_NAMES = [
    'Mallard', 'Teal', 'Canvasback', 'Pintail', 'Gadwall',
    'Wigeon', 'Shoveler', 'Redhead', 'Scaup', 'Bufflehead'
]

COLOR_SCHEMES = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8E8', '#F7DC6F', '#BB8FCE', '#85C1E9',
    '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D7BDE2',
    '#A9CCE3', '#AED6F1', '#A3E4D7', '#D5F3FE', '#FADBD8'
]

def lambda_handler(event, context):
    """Main Lambda handler - renamed from 'handler' for clarity"""
    return handler(event, context)

def handler(event, context):
    """Generate duck avatar image based on traits"""
    try:
        # Parse request
        if isinstance(event.get('body'), str):
            body = json.loads(event['body'])
        else:
            body = event.get('body', event)
        
        duck_profile = body.get('duckProfile', {})
        traits = duck_profile.get('traits', {})
        
        # Generate unique filename
        token_id = duck_profile.get('tokenId', 'unknown')
        timestamp = int(datetime.now().timestamp())
        filename = f"ducks/{token_id}-{timestamp}.png"
        
        # Create duck image
        image_data = create_duck_image(traits, duck_profile)
        
        # Upload to S3
        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=filename,
            Body=image_data,
            ContentType='image/png',
            CacheControl='max-age=31536000'  # 1 year cache
        )
        
        # Return CloudFront URL
        image_url = f"https://{CLOUDFRONT_DOMAIN}/{filename}"
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'imageUrl': image_url,
                'filename': filename
            })
        }
        
    except Exception as e:
        print(f"Error generating duck image: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': f'Failed to generate image: {str(e)}'})
        }

def create_duck_image(traits, profile):
    """Create a duck avatar image using PIL"""
    # Create canvas
    width, height = 400, 400
    image = Image.new('RGBA', (width, height), (255, 255, 255, 0))
    draw = ImageDraw.Draw(image)
    
    # Get trait values with defaults
    rarity = traits.get('rarity', 1)
    species = traits.get('species', 1)
    color_idx = traits.get('color', 1)
    personality = traits.get('personality', 1)
    level = profile.get('level', 1)
    
    # Background based on rarity
    rarity_color = RARITY_COLORS.get(rarity, RARITY_COLORS[1])
    draw_gradient_background(draw, width, height, rarity_color)
    
    # Duck body color
    body_color = COLOR_SCHEMES[color_idx % len(COLOR_SCHEMES)]
    
    # Draw duck body
    draw_duck_body(draw, width, height, body_color, personality)
    
    # Add rarity border
    border_width = min(5, rarity * 2)
    draw.rectangle([0, 0, width-1, height-1], outline=rarity_color, width=border_width)
    
    # Add level indicator
    try:
        # Try to load custom font
        font = ImageFont.truetype('fonts/arial.ttf', 24)
    except:
        font = ImageFont.load_default()
    
    level_text = f"Lv.{level}"
    draw.text((width-80, 20), level_text, fill='white', font=font, stroke_width=2, stroke_fill='black')
    
    # Add species name
    species_name = SPECIES_NAMES[(species-1) % len(SPECIES_NAMES)]
    draw.text((20, height-40), species_name, fill='white', font=font, stroke_width=2, stroke_fill='black')
    
    # Convert to bytes
    buffer = BytesIO()
    image.save(buffer, format='PNG', optimize=True)
    return buffer.getvalue()

def draw_gradient_background(draw, width, height, color):
    """Draw a gradient background"""
    r, g, b = hex_to_rgb(color)
    for y in range(height):
        alpha = int(50 + (y / height) * 100)
        # Create gradient effect
        gradient_r = min(255, r + int((y / height) * 30))
        gradient_g = min(255, g + int((y / height) * 20))
        gradient_b = min(255, b + int((y / height) * 10))
        current_color = (gradient_r, gradient_g, gradient_b)
        draw.line([(0, y), (width, y)], fill=current_color)

def draw_duck_body(draw, width, height, color, personality):
    """Draw simplified duck shape"""
    center_x, center_y = width // 2, height // 2
    
    # Body (ellipse)
    body_size = 120
    draw.ellipse([
        center_x - body_size//2, 
        center_y - body_size//3,
        center_x + body_size//2,
        center_y + body_size//2
    ], fill=color, outline='black', width=3)
    
    # Head (circle) 
    head_size = 80
    head_y = center_y - 60
    draw.ellipse([
        center_x - head_size//2,
        head_y - head_size//2,
        center_x + head_size//2, 
        head_y + head_size//2
    ], fill=color, outline='black', width=3)
    
    # Beak
    beak_points = [
        (center_x - 15, head_y),
        (center_x - 35, head_y + 5),
        (center_x - 15, head_y + 10)
    ]
    draw.polygon(beak_points, fill='orange', outline='black', width=2)
    
    # Eyes (personality affects eye expression)
    eye_size = 12
    left_eye = (center_x - 20, head_y - 10)
    right_eye = (center_x + 20, head_y - 10)
    
    # Eye shape based on personality
    if personality <= 2:  # Happy/friendly
        draw.arc([left_eye[0]-eye_size, left_eye[1]-eye_size, 
                 left_eye[0]+eye_size, left_eye[1]+eye_size], 
                 0, 180, fill='black', width=3)
        draw.arc([right_eye[0]-eye_size, right_eye[1]-eye_size,
                 right_eye[0]+eye_size, right_eye[1]+eye_size],
                 0, 180, fill='black', width=3)
    elif personality <= 4:  # Normal
        draw.ellipse([left_eye[0]-eye_size//2, left_eye[1]-eye_size//2,
                     left_eye[0]+eye_size//2, left_eye[1]+eye_size//2],
                     fill='black')
        draw.ellipse([right_eye[0]-eye_size//2, right_eye[1]-eye_size//2,
                     right_eye[0]+eye_size//2, right_eye[1]+eye_size//2],
                     fill='black')
    else:  # Mischievous/winking
        draw.ellipse([left_eye[0]-eye_size//2, left_eye[1]-eye_size//2,
                     left_eye[0]+eye_size//2, left_eye[1]+eye_size//2],
                     fill='black')
        draw.line([right_eye[0]-eye_size//2, right_eye[1],
                   right_eye[0]+eye_size//2, right_eye[1]], 
                   fill='black', width=3)

def hex_to_rgb(hex_color):
    """Convert hex color to RGB tuple"""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))