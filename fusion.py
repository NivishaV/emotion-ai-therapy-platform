def fuse_emotions(face_emotion, text_emotion):

    if face_emotion is None:
        return text_emotion

    if text_emotion is None:
        return face_emotion

    # If both same → strong confidence
    if face_emotion.lower() == text_emotion.lower():
        return face_emotion

    # Otherwise prioritize text emotion
    return text_emotion